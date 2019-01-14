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

You can specify properties to omit by setting an `omitFields` option. This option takes an array of field names. For example, if you wanted to exclude the `trash` field from the export, you'd configure your piece like this:

```javascript
modules: {
  'apostrophe-pieces-export': {},
  // other modules...
  'my-module-that-extends-pieces': {
    export: {
      omitFields: ['trash']
    }
  }
}
```

**No changes to templates are required to enable the export button.** It will appear automatically in the "Manage" dialog box for the appropriate type of piece.

## Exporting a file

Just click the "export" button in the "manage" view of your pieces. A progress display will appear. Once the export has completed, you will be instructed to click "Done," at which point the file will be downloaded. **For space and security reasons, export files expire after one hour,** so keep this in mind if you walk away from the export process.

## Extending the export process for your piece type

The exporter relies on a simple conversion from each standard field type to a string. That conversion works well for the same field types that import well with `apostrophe-pieces-importer`.

You can change this by implementing a beforeExport method in your pieces module. In this method a simple conversion has already been performed, but you may override properties of `record` based on what you see in `piece`.

```javascript
self.beforeExport = function(req, piece, record, callback) {
  // Export access counter that is not in schema
  record.accesses = piece.accesses || 0;
  return callback(null);
};
```

**Always include a given property in every object exported, even if it is just empty.**

## File formats beyond CSV, TSV and Excel

`apostrophe-pieces-export` supports `.csv`, `.tsv` and `.xlsx` right out of the box. But of course you want more.

So you'll need to call `exportAddFormat`, providing a file extension and an object with these properties:

```javascript
// We are implementing our own XML exporter
self.exportAddFormat('xml', {
  label: 'XML',
  output: // see below
});
```

`label` is a helpful label for the dropdown menu that selects a format when exporting.

> If a `form` exporter function is not available for a field type, you'll get the `string` representation.

`output` does the actual work of exporting the content.

`output` can be one of two things:

**1. Stream interface:** a function that, taking a `filename` argument, returns a writable Node.js object stream that objects can be piped into; the stream should support the `write()` method in the usual way. The `write()` method of the stream must accept objects whose property names correspond to the schema and whose values correspond to each row of output. *Generating a "header row," if desired, is your responsibility and can be inferred from the first data object you are given.*

**2. Callback interface:** a function that, accepting (`filename`, `objects`, `callback`), writes a complete file containing the given array of objects in your format and then invokes the callback. Each object in the array will contain all of the exported schema fields as properties, with string values.

This option is to be avoided for very large exports but it is useful when exporting formats for which no streaming interface is available.

Here is what an implementation for `.csv` files would look like if we didn't have it already:

```javascript
self.exportAddFormat('csv', {
  label: 'CSV',
  output: function(filename) {
    // csv-stringify already provides the right kind of
    // stream interface, including auto-discovery of headers
    // from the properties of the first object exported
    const out = stringify({ header: true });
    out.pipe(fs.createWriteStream(filename));
    return out;
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
