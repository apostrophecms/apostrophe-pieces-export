// http://talesofthefluxfox.com/2016/10/07/writing-to-xlsx-spreadsheets-in-node-js/

const ALPHA = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
  'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

const _ = require('lodash');
const XLSX = require('xlsx');

function objectsToWorkbook(objects, selectedFields, spreadsheetName)
{

  var rowsOfData = objects;
  var lineNum = 1;
  var worksheetColumns = [];

  selectedFields.forEach(function ()
  {
    worksheetColumns.push(
    {
      wch: 25
    });
  });

  var workbook = {
    SheetNames: [spreadsheetName],
    Sheets:
    {
      [spreadsheetName]:
      {
        '!ref': 'A1:',
        '!cols': worksheetColumns
      }
    }
  };

  for (var i = 0; i < selectedFields.length; i++)
  {
    worksheetColumns.push(
    {
      wch: 25
    });
    var currentCell = _calculateCurrentCellReference(i, lineNum);
    workbook.Sheets[spreadsheetName][currentCell] = {
      t: "s",
      v: selectedFields[i],
      s:
      {
        font:
        {
          bold: true
        }
      }
    };
  }
  lineNum++;
  rowsOfData.forEach(function (offer)
  {
    for (var i = 0; i < selectedFields.length; i++)
    {
      var displayValue = offer[selectedFields[i]];
      var currentCell = _calculateCurrentCellReference(i, lineNum);
      workbook.Sheets[spreadsheetName][currentCell] = {
        t: "s",
        v: displayValue,
        s:
        {
          font:
          {
            sz: "11",
            bold: false
          },
          alignment:
          {
            wrapText: true,
            vertical: 'top'
          },
          fill:
          {
            fgColor:
            {
              rgb: 'ffffff'
            }
          },
          border:
          {
            left:
            {
              style: 'thin',
              color:
              {
                auto: 1
              }
            },
            right:
            {
              style: 'thin',
              color:
              {
                auto: 1
              }
            },
            top:
            {
              style: 'thin',
              color:
              {
                auto: 1
              }
            },
            bottom:
            {
              style: 'thin',
              color:
              {
                auto: 1
              }
            }
          }
        }
      };
    }
    lineNum++;
  });
  var lastColumnInSheet = selectedFields.length - 1;
  var endOfRange = _calculateCurrentCellReference(lastColumnInSheet, lineNum);
  workbook.Sheets[spreadsheetName]['!ref'] += endOfRange;
  return workbook;
}

function _calculateCurrentCellReference(index, lineNumber)
{
  return (index > 25) ? ALPHA[Math.floor((index / 26) - 1)] + ALPHA[index % 26] + lineNumber : ALPHA[index] + lineNumber;
}

function _longFormCalculateCurrentCellReference(index, lineNumber)
{
  var currentCellReference = '';
  var alphaVal = '';
  if (index > 25)
  {
    var firstLetterVal = Math.floor((index / 26) - 1);
    var secondLetterVal = index % 26;
    alphaVal = ALPHA[firstLetterVal] + ALPHA[secondLetterVal];
    currentCellReference = alphaVal + lineNumber;
  }
  else
  {
    alphaVal = ALPHA[index];
    currentCellReference = alphaVal + lineNumber;
  }
  return currentCellReference;
}

module.exports = function(self) {
  return {
    label: 'Excel (.xlsx)',
    convert: 'string',
    output: function(filename, objects, callback) {
      try {
        const workbook = objectsToWorkbook(objects, _.map(self.schema, 'name'), self.pluralLabel);
        XLSX.writeFile(workbook, filename);
      } catch (e) {
        return callback(e);
      }
      return setImmediate(callback);
    }
  };
};
