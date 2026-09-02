package com.example.bnianchorcheckinbackend

import org.w3c.dom.Element
import org.w3c.dom.Node
import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream
import javax.xml.parsers.DocumentBuilderFactory

/**
 * Parse BNI Member Traffic Light `.xlsx` without Apache POI (OOXML zip + XML).
 *
 * Prefers the workbook sheet whose name contains “Traffic”. Member names start at column B row 5.
 * Side effects: none (pure parse). Does not execute Excel formulas.
 *
 * Note: [splitRef] returns `(row, col)` — do not destructure as `(col, row)` or names come back empty.
 */
object TrafficLightXlsxParser {
    /**
     * @param bytes `.xlsx` zip bytes
     * @return import payload with member rows
     * @throws IllegalArgumentException when the zip/sheet/rows are unusable
     */
    fun parse(bytes: ByteArray): TrafficLightImportRequest {
        val files = unzip(bytes)
        val shared = parseSharedStrings(files["xl/sharedStrings.xml"])
        val fills = parseFills(files["xl/styles.xml"])
        val cellXfs = parseCellXfs(files["xl/styles.xml"])
        val sheetPath = resolveTrafficLightSheetPath(files)
        val sheetXml = files[sheetPath] ?: throw IllegalArgumentException("找不到 Traffic Light Report 工作表")
        return parseSheet(sheetXml, shared, fills, cellXfs)
    }

    /** Read XML/rels entries from the OOXML zip. */
    private fun unzip(bytes: ByteArray): Map<String, String> {
        val out = mutableMapOf<String, String>()
        ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            var entry = zip.nextEntry
            while (entry != null) {
                if (!entry.isDirectory && (entry.name.endsWith(".xml") || entry.name.endsWith(".rels"))) {
                    out[entry.name] = zip.readBytes().toString(Charsets.UTF_8)
                }
                zip.closeEntry()
                entry = zip.nextEntry
            }
        }
        return out
    }

    /** Workbook sheet named like Traffic Light Report, else the first sheet. */
    private fun resolveTrafficLightSheetPath(files: Map<String, String>): String {
        val workbook = files["xl/workbook.xml"] ?: throw IllegalArgumentException("Invalid xlsx: missing workbook")
        val rels = files["xl/_rels/workbook.xml.rels"] ?: throw IllegalArgumentException("Invalid xlsx: missing workbook rels")
        val wbDoc = parseXml(workbook)
        val relDoc = parseXml(rels)
        val ridToTarget = relDoc.getElementsByTagName("*").asElements()
            .filter { it.localOrName() == "Relationship" }
            .associate { it.getAttribute("Id") to it.getAttribute("Target") }
        val sheets = wbDoc.getElementsByTagName("*").asElements().filter { it.localOrName() == "sheet" }
        val preferred = sheets.firstOrNull { it.getAttribute("name").contains("Traffic", ignoreCase = true) }
            ?: sheets.firstOrNull()
            ?: throw IllegalArgumentException("Excel 沒有工作表")
        val rid = preferred.getAttribute("r:id").ifBlank { preferred.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") }
        val target = ridToTarget[rid] ?: "worksheets/sheet1.xml"
        val normalized = target.removePrefix("/")
        return if (normalized.startsWith("xl/")) normalized else "xl/$normalized"
    }

    /** Shared-string table; phonetic runs (`rPh`) stripped so names are not duplicated. */
    private fun parseSharedStrings(xml: String?): List<String> {
        if (xml.isNullOrBlank()) return emptyList()
        val siBlocks = Regex("<si\\b[^>]*>(.*?)</si>", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL))
            .findAll(xml)
        return siBlocks.map { si ->
            val body = si.groupValues[1].replace(Regex("<rPh\\b.*?</rPh>", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)), "")
            Regex("<t\\b[^>]*>(.*?)</t>", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL))
                .findAll(body)
                .joinToString("") { it.groupValues[1].unescapeXml() }
        }.toList()
    }

    /** Theme fill RGBs in styles.xml order (index = fillId). */
    private fun parseFills(xml: String?): List<String?> {
        if (xml.isNullOrBlank()) return emptyList()
        val doc = parseXml(xml)
        return doc.getElementsByTagName("*").asElements()
            .filter { it.localOrName() == "fill" }
            .map { fill ->
                fill.getElementsByTagName("*").asElements()
                    .firstOrNull { it.localOrName() == "fgColor" }
                    ?.getAttribute("rgb")
                    ?.ifBlank { null }
            }
    }

    /** cellXfs → fillId per style index (`s` on `<c>`). */
    private fun parseCellXfs(xml: String?): List<Int> {
        if (xml.isNullOrBlank()) return emptyList()
        val doc = parseXml(xml)
        val cellXfs = doc.getElementsByTagName("*").asElements().firstOrNull { it.localOrName() == "cellXfs" }
            ?: return emptyList()
        return cellXfs.childElements().filter { it.localOrName() == "xf" }.map {
            it.getAttribute("fillId").toIntOrNull() ?: 0
        }
    }

    /**
     * Grid from sheet cells: row 1 chapter, row 2 period, row 3 KPI goals, row 5+ members.
     * Skip “Perfect” and non-letter names.
     */
    private fun parseSheet(
        xml: String,
        shared: List<String>,
        fills: List<String?>,
        cellXfs: List<Int>
    ): TrafficLightImportRequest {
        val grid = mutableMapOf<Pair<Int, Int>, SheetCell>()
        val cellRe = Regex(
            """<c\s+([^>]*?)/>|<c\s+([^>]*?)>(.*?)</c>""",
            setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)
        )
        cellRe.findAll(xml).forEach { match ->
            val attrs = match.groupValues[1].ifBlank { match.groupValues[2] }
            val inner = match.groupValues[3]
            val ref = Regex("""\br="([A-Z]+\d+)"""", RegexOption.IGNORE_CASE).find(attrs)?.groupValues?.get(1) ?: return@forEach
            val (row, col) = splitRef(ref)
            if (row == 0) return@forEach
            val type = Regex("""\bt="([^"]+)"""").find(attrs)?.groupValues?.get(1)
            val style = Regex("""\bs="(\d+)"""").find(attrs)?.groupValues?.get(1)?.toIntOrNull()
            val raw = Regex("""<v\b[^>]*>(.*?)</v>""", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL))
                .find(inner)?.groupValues?.get(1)
            val inline = Regex("""<t\b[^>]*>(.*?)</t>""", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL))
                .find(inner)?.groupValues?.get(1)
            val text = when {
                type == "s" -> shared.getOrNull(raw?.toIntOrNull() ?: -1) ?: ""
                type == "inlineStr" -> inline?.unescapeXml().orEmpty()
                raw != null -> raw
                else -> ""
            }
            val fillRgb = style?.let { xf ->
                val fillId = cellXfs.getOrNull(xf)
                fillId?.let { fills.getOrNull(it) }
            }
            grid[row to col] = SheetCell(text, fillRgb)
        }
        val maxRow = grid.keys.maxOfOrNull { it.first } ?: 0
        fun cell(r: Int, col: Int) = grid[r to col]

        val chapterName = cell(1, 1)?.text?.trim().orEmpty().ifBlank { "Anchor" }
        val periodLabel = cell(2, 1)?.text?.trim().orEmpty().ifBlank { "Traffic Light" }
        val period = Regex("""(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})""").find(periodLabel)
        var greenGoal = 60
        var yellowGoal = 40
        for (col in 1..20) {
            val t = cell(3, col)?.text.orEmpty()
            if (t.contains("Green Goal", ignoreCase = true)) {
                t.filter { it.isDigit() }.toIntOrNull()?.let { greenGoal = it }
            }
            if (t.contains("Yellow Goal", ignoreCase = true)) {
                t.filter { it.isDigit() }.toIntOrNull()?.let { yellowGoal = it }
            }
        }

        var perfectPresent: Int? = null
        val rows = mutableListOf<TrafficLightRowDto>()
        for (r in 5..maxRow) {
            val name = cell(r, 2)?.text?.trim().orEmpty()
            if (name.isEmpty()) continue
            if (name.equals("Perfect", ignoreCase = true)) {
                perfectPresent = cell(r, 4)?.text.toIntOrZero()
                continue
            }
            if (!name.first().isLetter()) continue
            val pts = cell(r, 16)?.text.toIntOrZero()
            val fill = cell(r, 2)?.fillRgb
            val light = lightFromFill(fill) ?: TrafficLightScoring.lightFromPts(pts)
            rows += TrafficLightRowDto(
                name = name,
                present = cell(r, 4)?.text.toIntOrZero(),
                absent = cell(r, 5)?.text.toIntOrZero(),
                late = cell(r, 6)?.text.toIntOrZero(),
                medical = cell(r, 7)?.text.toIntOrZero(),
                substitute = cell(r, 8)?.text.toIntOrZero(),
                referralsGiven = cell(r, 9)?.text.toIntOrZero(),
                referralsReceived = cell(r, 10)?.text.toIntOrZero(),
                visitors = cell(r, 11)?.text.toIntOrZero(),
                oneToOnes = cell(r, 12)?.text.toIntOrZero(),
                training = cell(r, 13)?.text.toIntOrZero(),
                bizGive = cell(r, 14)?.text.toDoubleOrZero(),
                plsPct = cell(r, 15)?.text.toIntOrZero(),
                totalPts = pts,
                light = light
            )
        }
        if (rows.isEmpty()) throw IllegalArgumentException("搵唔到會員列。請確認係 Anchor Member Traffic Light Excel。")
        return TrafficLightImportRequest(
            periodLabel = periodLabel,
            periodStart = period?.groupValues?.get(1),
            periodEnd = period?.groupValues?.get(2),
            greenGoal = greenGoal,
            yellowGoal = yellowGoal,
            filename = chapterName,
            perfectPresent = perfectPresent,
            rows = rows
        )
    }

    /** Excel theme RGB (with or without `FF` alpha) → light, or null to fall back to points. */
    private fun lightFromFill(rgb: String?): String? {
        if (rgb.isNullOrBlank()) return null
        val u = rgb.removePrefix("#").removePrefix("FF").uppercase()
        return when (u) {
            "CCFFCC", "92D050", "C6EFCE" -> "GREEN"
            "FFFF99", "FFFF00", "FFEB9C" -> "YELLOW"
            "FF99CC", "FFC7CE", "FF0000" -> "RED"
            "CCCCCC", "BFBFBF", "000000" -> "BLACK"
            else -> null
        }
    }

    private data class SheetCell(val text: String, val fillRgb: String?)

    /**
     * A1-style ref → `(row, col)` with col 1-based (`A` = 1).
     * Callers must destructure as `val (row, col) = splitRef(ref)`.
     */
    private fun splitRef(ref: String): Pair<Int, Int> {
        val m = Regex("^([A-Z]+)(\\d+)$").find(ref.uppercase())
            ?: return 0 to 0
        val col = m.groupValues[1].fold(0) { acc, ch -> acc * 26 + (ch - 'A' + 1) }
        return m.groupValues[2].toInt() to col
    }

    /** Namespace-aware parse with DTD/XXE features disabled. */
    private fun parseXml(xml: String) = DocumentBuilderFactory.newInstance().apply {
        isNamespaceAware = true
        isExpandEntityReferences = false
        listOf(
            "http://apache.org/xml/features/disallow-doctype-decl",
            "http://xml.org/sax/features/external-general-entities",
            "http://xml.org/sax/features/external-parameter-entities"
        ).forEach { feature ->
            try {
                setFeature(feature, feature.endsWith("disallow-doctype-decl"))
            } catch (_: Exception) {
            }
        }
    }.newDocumentBuilder().parse(ByteArrayInputStream(xml.toByteArray(Charsets.UTF_8)))

    private fun org.w3c.dom.NodeList.asElements(): List<Element> =
        (0 until length).mapNotNull { item(it) as? Element }

    private fun Element.childElements(): List<Element> {
        val out = mutableListOf<Element>()
        var n = firstChild
        while (n != null) {
            if (n.nodeType == Node.ELEMENT_NODE) out += n as Element
            n = n.nextSibling
        }
        return out
    }

    private fun String.unescapeXml(): String =
        replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&apos;", "'")

    private fun Element.localOrName(): String = if (localName.isNullOrBlank()) tagName.substringAfter(":") else localName

    private fun String?.toIntOrZero(): Int {
        if (this.isNullOrBlank() || this == "∞") return 0
        return this.replace(",", "").replace(" ", "").toDoubleOrNull()?.toInt() ?: 0
    }

    private fun String?.toDoubleOrZero(): Double {
        if (this.isNullOrBlank()) return 0.0
        return this.replace(",", "").replace(" ", "").toDoubleOrNull() ?: 0.0
    }
}
