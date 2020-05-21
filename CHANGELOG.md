## Changelog

### 2.3.0

* Added a `filters` option, allowing custom filters to be added to the export dialog box. Thanks to Michelin for making this work possible via Apostrophe Enterprise Support.

### 2.2.0

* Added the `exportAsPlaintext: true` option, which can be set on any `area` or `singleton` schema field to export just the plaintext, rather than the markup.

* Fixed and enhanced the unit tests.

### 2.1.0

* Added the `omitFields` option, an array of schema fields that should not be exported.

### 2.0.1

Compatible with Node 6+. `csv-stringify` yoinked ES5 support by default, but provided an alternative entry point to `require` for it.

### 2.0.0

Initial release, with tests.
