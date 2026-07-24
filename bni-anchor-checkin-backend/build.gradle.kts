import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
	id("org.springframework.boot") version "3.4.0"
	id("io.spring.dependency-management") version "1.1.4"
	kotlin("jvm") version "1.9.20"
	kotlin("plugin.spring") version "1.9.20"
	kotlin("plugin.jpa") version "1.9.20"
	id("org.owasp.dependencycheck") version "12.1.0"
}

group = "com.example"
version = "0.0.1-SNAPSHOT"

java {
	sourceCompatibility = JavaVersion.VERSION_17
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-web")
	implementation("org.springframework.boot:spring-boot-starter-websocket")
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.postgresql:postgresql:42.7.1")
	implementation("com.h2database:h2:2.2.224")
	implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
	implementation("org.jetbrains.kotlin:kotlin-reflect")
	implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.6.0")
	testImplementation("org.springframework.boot:spring-boot-starter-test")
}

// SRAA Security Risk Assessment: SCA scan; fail on High/Critical (CVSS >= 7)
dependencyCheck {
	failBuildOnCVSS = 7.0f
	formats = listOf("HTML", "JSON")
	outputDirectory = "${layout.buildDirectory.get().asFile}/reports"
	suppressionFile = "dependency-check-suppressions.xml"
	nvd {
		apiKey = System.getenv("NVD_API_KEY")
	}
	analyzers {
		assemblyEnabled = false
		ossIndexEnabled = true
	}
}

tasks.register("sraaSecurityAudit") {
	group = "verification"
	description = "SRAA gate: OWASP Dependency-Check (CVSS>=7) + unit tests + bootJar"
	dependsOn("dependencyCheckAnalyze", "test", "bootJar")
}

tasks.withType<KotlinCompile> {
	kotlinOptions {
		freeCompilerArgs = listOf("-Xjsr305=strict")
		jvmTarget = "17"
	}
}

tasks.withType<Test> {
	useJUnitPlatform()
}
