# apostrophe-pieces-export

This module adds an optional export feature to all `apostrophe-pieces` in an [Apostrophe](http://apostrophecms.org) project.

## in app.js

```javascript
modules: {
  'apostrophe-pieces-export': {},
  // other modules...
  'my-module-that-extends-pieces': {
    // Without this, there is no export functionality for this type.
    // Not all types are great candidates for exports.
    export: true
  }
}
```

**No changes to templates are required to enable the export button.** It will appear automatically in the "Manage" dialog box for the appropriate type of piece.

## Exporting a file

Just click the "export" button in the "manage" view of your pieces. A progress display will appear, then you will be invited to download and save a file.

## Extending the export process for your piece type

By default, the exporter relies on a simple conversion from each standard field type to a string.

To accomplish this, all of the standard schema field types are given an `exporters` property with a `string` sub-property, which is a function that converts that field back to a string. In other words, it is the reverse of the `string` sub-property of the `converters` property, which is relied upon by the related module `apostrophe-pieces-import`.

You can change this in one of two ways:

1. You can **implement a beforeExport method** in your pieces module. This method simply adds extra data from `piece` to `record`, which is a simple object in which the keys are property names and the values are strings representing those properties:

```javascript
self.beforeExport = function(job, piece, record, callback) {
  // Export an access counter
  record.accesses = (piece.accesses || '').toString();
  return callback(null);
};
```

**All of the properties you add here must appear in the schema. Otherwise they will not be successfully included in the export.** However, this can still be a convenient way to bypass implementing custom schema field types. If the fields are not really meant to be editable via the schema, you can add them like this via `addFields`:

```javascript
{
  type: 'string',
  name: 'accesses',
  contextual: true
}
```

2. You can **set an `exporters` property for your custom schema field types**, with a `string` sub-property. That sub-property should be a function that accepts `(req, object, name, data, field, callback)`. This function should set `data[name]` to a string which represents the value `object[name]`. For some field types, the right way to do that is obvious. For others, you might refer to the converter function in use for that field type.

## File formats beyond CSV, TSV and Excel

`apostrophe-pieces-export` supports `.csv`, `.tsv` and `.xlsx` right out of the box. But of course you want more.

So you'll need to call `exportAddFormat`, providing a file extension and an object with these properties:

```javascript
// We are implementing our own XML exporter
self.exportAddFormat('xml', {
  label: 'XML',
  // default: simple string output for each field
  convert: 'string',
  output: // see below
});
```

`label` is a helpful label for the dropdown menu that selects a format when exporting.

`convert` may be set to `string` or `form`, and defaults to `string`. When using `string`, the values given to you for each field will be strings, when using `form` they will correspond to the format used when saving Apostrophe forms. When in doubt, use `string`.

> If a `form` exporter function is not available for a field type, you'll get the `string` representation.

`output` does the actual work of exporting the content.

`output` can be one of two things:

**1. Stream interface:** a function that, taking no arguments, returns a writable Node.js object stream that objects can be piped into; the stream should support the `write()` method in the usual way. The `write()` method of the stream must accept objects whose property names correspond to the schema and whose values correspond to each row of output. *Generating a "header row," if desired, is your responsibility and can be inferred from the first object you are given.* 

**2. Callback interface:** a function that, accepting (`filename`, `objects`, `callback`), writes a complete file containing the given array of objects in your format and then invokes the callback. Each object in the array will contain all of the exported schema fields as properties, with string values.

This option is to be avoided for very large files but it is useful when exporting formats for which no streaming interface
is available.

`convert` should be set to `'string'` if the properties of each object read
from the stream are always strings, or `form` if they correspond to the format submitted
by apostrophe's forms on the front end. If in doubt, use `string`.

Here is what an implementation for `.csv` files would look like if we didn't have it already:

```javascript
self.exportAddFormat('csv', {
  label: 'CSV',
  convert: 'string',
  output: function() {
    // csv-stringify already provides the right kind of
    // stream interface, including auto-discovery of headers
    // from the properties of the first object exported
    return require('csv-stringify')();
  }
});
```

## Making new file formats available throughout your project

If you call `exportAddFormat` in your module that extends pieces, you're adding it just for that one type.

If you call it from `lib/modules/apostrophe-pieces/index.js` in your project, you're adding it for all pieces in your project. **Make sure you check that export is turned on:**

```javascript
// lib/modules/apostrophe-pieces/index.js
module.exports = {
  construct: function(self, options) {
    if (options.export) {
      self.exportAddFormat('myextension', {
        // your definition here
      });
    }
  }
}
```

*The method won't exist if the export option is not active for this type.*

## Making new file formats available to everyone

Pack it up in an npm module called, let's say, `pieces-export-fancyformat`. Your `index.js` will look like:

```javascript
// node_modules/pieces-export-myextension/index.js
module.exports = {
  // Further improve the apostrophe-pieces module throughout projects
  // that add this module
  improve: 'apostrophe-pieces',
  construct: function(self, options) {
    if (options.export) {
      self.exportAddFormat('myextension', {
        // your definition here
      });
    }
  }
}
```

This module further improves `apostrophe-pieces`. In `app.js` developers will want to include both:

```javascript
// app.js
modules: {
  'apostrophe-pieces-export': {},
  'pieces-export-fancyformat': {}
}
```

> To avoid confusion with our official modules, please don't call your own module `apostrophe-pieces-export-fancyformat` without coordinating with us first. Feel free to use your own prefix.
