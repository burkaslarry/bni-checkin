# CSV Import Schema

The admin import page accepts CSV files for members and guests. Files are parsed with headers, so column order is flexible as long as the supported header names are present.

## Guest Import

Template: `data/templates/guest-import-template.csv`

Required fields:

- `name`: Guest full name.
- `profession`: Guest profession or business category. The importer also accepts `category`.

Optional fields:

- `email`: Guest email address. If provided, it must be a valid email format.
- `phone`: Guest phone number.
- `referrer`: Member or contact who invited the guest.
- `event_date`: Event date in `YYYY-MM-DD` format. The importer also accepts `eventdate`. If omitted, the current event date is used.

Example:

```csv
name,profession,phone,referrer,event_date
Jane Smith,Marketing Consultant,87654321,Larry Lo,2026-02-10
```

Before guest import, the target event date must already exist in the admin event management page.

## Member Import

Template: `data/templates/member-import-template.csv`

Required fields:

- `name`: Member full name.
- `profession`: Member profession or business category.

Optional fields:

- `email`: Member email address. If provided, it must be a valid email format.
- `phone`: Member phone number.
- `standing`: Member standing. Supported values are `GREEN`, `YELLOW`, `RED`, and `BLACK`. If omitted, the backend defaults to `GREEN`.

Example:

```csv
name,profession,email,phone,standing
John Doe,Software Development,john@example.com,61234567,GREEN
```

## Header Aliases

The frontend normalizes headers by trimming whitespace, removing a UTF-8 BOM, lowercasing, and converting spaces or hyphens to underscores.

Supported aliases:

- `profession` or `category`
- `event_date` or `eventdate`

## Import Behavior

- Existing members are matched by case-insensitive name and updated.
- Existing guests are matched by case-insensitive name and updated.
- Empty optional fields are ignored where possible.
- Imports return inserted, updated, failed, and error counts.
