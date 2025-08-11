import expect from "expect";
import {describe, it} from "mocha";
import {
  gridCodeFrom,
  gridReference10From,
  gridReference6From,
  gridReference8From,
  gridReferenceFrom
} from "./grid-reference";

describe("Grid Reference Functions", () => {

  describe("gridReference6From", () => {

    it("should return 6-digit grid reference for Challock", () => {
      expect(gridReference6From(600564, 150590)).toEqual("TR005505");
    });

    it("should return 6-digit grid reference for Kingsnorth, Kent", () => {
      expect(gridReference6From(600323, 139147)).toEqual("TR003391");
    });

    it("should return 6-digit grid reference for Bethersden, Kent (TN26 3AL)", () => {
      expect(gridReference6From(592716, 140476)).toEqual("TQ927404");
    });

    it("should return 6-digit grid reference for Bethersden, Kent (TN26 3HF)", () => {
      expect(gridReference6From(589125, 140511)).toEqual("TQ891405");
    });

  });

  describe("gridReference8From", () => {

    it("should return 8-digit grid reference for Challock", () => {
      expect(gridReference8From(600564, 150590)).toEqual("TR00565059");
    });

    it("should return 8-digit grid reference for Kingsnorth, Kent", () => {
      expect(gridReference8From(600323, 139147)).toEqual("TR00323914");
    });

    it("should return 8-digit grid reference for Bethersden, Kent (TN26 3AL)", () => {
      expect(gridReference8From(592716, 140476)).toEqual("TQ92714047");
    });

    it("should return 8-digit grid reference for Bethersden, Kent (TN26 3HF)", () => {
      expect(gridReference8From(589125, 140511)).toEqual("TQ89124051");
    });

  });

  describe("gridReference10From", () => {

    it("should return 10-digit grid reference for Challock", () => {
      expect(gridReference10From(600564, 150590)).toEqual("TR0056450590");
    });

    it("should return 10-digit grid reference for Kingsnorth, Kent", () => {
      expect(gridReference10From(600323, 139147)).toEqual("TR0032339147");
    });

    it("should return 10-digit grid reference for Bethersden, Kent (TN26 3AL)", () => {
      expect(gridReference10From(592716, 140476)).toEqual("TQ9271640476");
    });

    it("should return 10-digit grid reference for Bethersden, Kent (TN26 3HF)", () => {
      expect(gridReference10From(589125, 140511)).toEqual("TQ8912540511");
    });

  });

  describe("gridCodeFrom", () => {

    it("should return grid code for Challock", () => {
      expect(gridCodeFrom(600564, 150590)).toEqual("TR");
    });

    it("should return grid code for Kingsnorth, Kent", () => {
      expect(gridCodeFrom(600323, 139147)).toEqual("TR");
    });

    it("should return grid code for Bethersden, Kent (TN26 3AL)", () => {
      expect(gridCodeFrom(592716, 140476)).toEqual("TQ");
    });

    it("should return grid code for Bethersden, Kent (TN26 3HF)", () => {
      expect(gridCodeFrom(589125, 140511)).toEqual("TQ");
    });

  });

  describe("gridReferenceFrom", () => {

    it("should return grid reference for Kent", () => {
      expect(gridReferenceFrom(589060, 140509)).toEqual("TQ8906040509");
    });

    it("should return grid reference for Scotland", () => {
      expect(gridReferenceFrom(403183, 78709)).toEqual("SZ0318378709");
    });

    it("should return grid reference for London", () => {
      expect(gridReferenceFrom(530000, 180000)).toEqual("TQ3000080000");
    });

    it("should return grid reference for Manchester", () => {
      expect(gridReferenceFrom(384000, 398000)).toEqual("SJ8400098000");
    });

    it("should return grid reference for Birmingham", () => {
      expect(gridReferenceFrom(407000, 286000)).toEqual("SP0700086000");
    });

    it("should return grid reference for Edinburgh", () => {
      expect(gridReferenceFrom(325000, 673000)).toEqual("NT2500073000");
    });

    it("should return grid reference for Cardiff", () => {
      expect(gridReferenceFrom(318000, 176000)).toEqual("ST1800076000");
    });

    it("should return grid reference for Glasgow", () => {
      expect(gridReferenceFrom(258000, 665000)).toEqual("NS5800065000");
    });

    it("should return grid reference for Liverpool", () => {
      expect(gridReferenceFrom(334000, 390000)).toEqual("SJ3400090000");
    });

    it("should return grid reference for Bristol", () => {
      expect(gridReferenceFrom(359000, 172000)).toEqual("ST5900072000");
    });

    it("should return grid reference for Leeds", () => {
      expect(gridReferenceFrom(430000, 433000)).toEqual("SE3000033000");
    });

    it("should return grid reference for Sheffield", () => {
      expect(gridReferenceFrom(435000, 387000)).toEqual("SK3500087000");
    });

    it("should return grid reference for Newcastle", () => {
      expect(gridReferenceFrom(425000, 565000)).toEqual("NZ2500065000");
    });

    it("should return grid reference for Nottingham", () => {
      expect(gridReferenceFrom(457000, 340000)).toEqual("SK5700040000");
    });

    it("should return grid reference for Leicester", () => {
      expect(gridReferenceFrom(488012, 166936)).toEqual("SU8801266936");
    });

    it("should return grid reference for Southampton", () => {
      expect(gridReferenceFrom(442000, 112000)).toEqual("SU4200012000");
    });

    it("should return grid reference for Portsmouth", () => {
      expect(gridReferenceFrom(441982, 111882)).toEqual("SU4198211882");
    });

    it("should return grid reference for Norwich", () => {
      expect(gridReferenceFrom(622977, 308549)).toEqual("TG2297708549");
    });

    it("should return grid reference for Oxford", () => {
      expect(gridReferenceFrom(451000, 206000)).toEqual("SP5100006000");
    });

    it("should return grid reference for Cambridge", () => {
      expect(gridReferenceFrom(545000, 258000)).toEqual("TL4500058000");
    });

    it("should return grid reference for Exeter", () => {
      expect(gridReferenceFrom(291914, 92560)).toEqual("SX9191492560");
    });

    it("should return grid reference for Plymouth", () => {
      expect(gridReferenceFrom(247764, 54429)).toEqual("SX4776454429");
    });

    it("should return grid reference for Derby", () => {
      expect(gridReferenceFrom(435000, 336000)).toEqual("SK3500036000");
    });

    it("should return grid reference for Stoke-on-Trent", () => {
      expect(gridReferenceFrom(388000, 346000)).toEqual("SJ8800046000");
    });

    it("should return grid reference for Coventry", () => {
      expect(gridReferenceFrom(433000, 278000)).toEqual("SP3300078000");
    });

    it("should return grid reference for Reading", () => {
      expect(gridReferenceFrom(471000, 173000)).toEqual("SU7100073000");
    });

    it("should return grid reference for Luton", () => {
      expect(gridReferenceFrom(509000, 222000)).toEqual("TL0900022000");
    });

    it("should return grid reference for Milton Keynes", () => {
      expect(gridReferenceFrom(486000, 238000)).toEqual("SP8600038000");
    });

    it("should return grid reference for Aberdeen", () => {
      expect(gridReferenceFrom(394000, 806000)).toEqual("NJ9400006000");
    });

    it("should return grid reference for Dundee", () => {
      expect(gridReferenceFrom(340000, 730000)).toEqual("NO4000030000");
    });

    it("should return grid reference for Inverness", () => {
      expect(gridReferenceFrom(266000, 845000)).toEqual("NH6600045000");
    });

    it("should return grid reference for Swansea", () => {
      expect(gridReferenceFrom(265000, 193000)).toEqual("SS6500093000");
    });

    it("should return grid reference for Newport", () => {
      expect(gridReferenceFrom(330000, 188000)).toEqual("ST3000088000");
    });

    it("should return grid reference for Wrexham", () => {
      expect(gridReferenceFrom(333000, 350000)).toEqual("SJ3300050000");
    });

    it("should return grid reference for Bangor", () => {
      expect(gridReferenceFrom(258000, 372000)).toEqual("SH5800072000");
    });

    it("should return grid reference for Chester", () => {
      expect(gridReferenceFrom(340000, 366000)).toEqual("SJ4000066000");
    });

    it("should return grid reference for Carlisle", () => {
      expect(gridReferenceFrom(340000, 556000)).toEqual("NY4000056000");
    });

    it("should return grid reference for Durham", () => {
      expect(gridReferenceFrom(427000, 542000)).toEqual("NZ2700042000");
    });

    it("should return grid reference for Lancaster", () => {
      expect(gridReferenceFrom(347000, 461000)).toEqual("SD4700061000");
    });

    it("should return grid reference for York", () => {
      expect(gridReferenceFrom(460000, 451000)).toEqual("SE6000051000");
    });

    it("should return grid reference for Bath", () => {
      expect(gridReferenceFrom(375000, 164000)).toEqual("ST7500064000");
    });

    it("should return grid reference for Cheltenham", () => {
      expect(gridReferenceFrom(394000, 222000)).toEqual("SO9400022000");
    });

    it("should return grid reference for Gloucester", () => {
      expect(gridReferenceFrom(383000, 218000)).toEqual("SO8300018000");
    });

    it("should return grid reference for Worcester", () => {
      expect(gridReferenceFrom(385000, 255000)).toEqual("SO8500055000");
    });

    it("should return grid reference for Hereford", () => {
      expect(gridReferenceFrom(350000, 240000)).toEqual("SO5000040000");
    });

    it("should return grid reference for Shrewsbury", () => {
      expect(gridReferenceFrom(349000, 312000)).toEqual("SJ4900012000");
    });

    it("should return grid reference for Challock", () => {
      expect(gridReferenceFrom(600564, 150590)).toEqual("TR0056450590");
    });

    it("should return grid reference for Kingsnorth, Kent", () => {
      expect(gridReferenceFrom(600323, 139147)).toEqual("TR0032339147");
    });

    it("should return grid reference for Bethersden, Kent (TN26 3AL)", () => {
      expect(gridReferenceFrom(592716, 140476)).toEqual("TQ9271640476");
    });

    it("should return grid reference for Bethersden, Kent (TN26 3HF)", () => {
      expect(gridReferenceFrom(589125, 140511)).toEqual("TQ8912540511");
    });

    it("should return grid reference for Shalloak Road, Kent (CT2 0PS)", () => {
      expect(gridReferenceFrom(616745, 160390)).toEqual("TR1674560390");
    });
  });

  describe("gridCodeFrom", () => {

    it("should return grid code for Kent", () => {
      expect(gridCodeFrom(589060, 140509)).toEqual("TQ");
    });

    it("should return grid code for Scotland", () => {
      expect(gridCodeFrom(403183, 78709)).toEqual("SZ");
    });

    it("should return grid code for London", () => {
      expect(gridCodeFrom(530000, 180000)).toEqual("TQ");
    });

    it("should return grid code for Manchester", () => {
      expect(gridCodeFrom(384000, 398000)).toEqual("SJ");
    });

    it("should return grid code for Birmingham", () => {
      expect(gridCodeFrom(407000, 286000)).toEqual("SP");
    });

    it("should return grid code for Edinburgh", () => {
      expect(gridCodeFrom(325000, 673000)).toEqual("NT");
    });

    it("should return grid code for Cardiff", () => {
      expect(gridCodeFrom(318000, 176000)).toEqual("ST");
    });

    it("should return grid code for Belfast", () => {
      expect(gridCodeFrom(146230, 529459)).toEqual("NW");
    });

    it("should return grid code for Glasgow", () => {
      expect(gridCodeFrom(258000, 665000)).toEqual("NS");
    });

    it("should return grid code for Liverpool", () => {
      expect(gridCodeFrom(334000, 390000)).toEqual("SJ");
    });

    it("should return grid code for Bristol", () => {
      expect(gridCodeFrom(359000, 172000)).toEqual("ST");
    });

    it("should return grid code for Leeds", () => {
      expect(gridCodeFrom(430000, 433000)).toEqual("SE");
    });

    it("should return grid code for Sheffield", () => {
      expect(gridCodeFrom(435000, 387000)).toEqual("SK");
    });

    it("should return grid code for Newcastle", () => {
      expect(gridCodeFrom(425000, 565000)).toEqual("NZ");
    });

    it("should return grid code for Nottingham", () => {
      expect(gridCodeFrom(457000, 340000)).toEqual("SK");
    });

    it("should return grid code for Leicester", () => {
      expect(gridCodeFrom(488012, 166936)).toEqual("SU");
    });

    it("should return grid code for Southampton", () => {
      expect(gridCodeFrom(442000, 112000)).toEqual("SU");
    });

    it("should return grid code for Portsmouth", () => {
      expect(gridCodeFrom(441982, 111882)).toEqual("SU");
    });

    it("should return grid code for Norwich", () => {
      expect(gridCodeFrom(622977, 308549)).toEqual("TG");
    });

    it("should return grid code for Oxford", () => {
      expect(gridCodeFrom(451000, 206000)).toEqual("SP");
    });

    it("should return grid code for Cambridge", () => {
      expect(gridCodeFrom(545000, 258000)).toEqual("TL");
    });

    it("should return grid code for Challock", () => {
      expect(gridCodeFrom(600564, 150590)).toEqual("TR");
    });

    it("should return grid code for Kingsnorth, Kent", () => {
      expect(gridCodeFrom(600323, 139147)).toEqual("TR");
    });

    it("should return grid code for Bethersden, Kent (TN26 3AL)", () => {
      expect(gridCodeFrom(592716, 140476)).toEqual("TQ");
    });

    it("should return grid code for Bethersden, Kent (TN26 3HF)", () => {
      expect(gridCodeFrom(589125, 140511)).toEqual("TQ");
    });

  });

  describe("Grid Reference Functions - All UK Grid Codes", () => {
    const gridLetters = [
      ["SV", "SW", "SX", "SY", "SZ", "TV", "TW"],
      ["SQ", "SR", "SS", "ST", "SU", "TQ", "TR"],
      ["SL", "SM", "SN", "SO", "SP", "TL", "TM"],
      ["SF", "SG", "SH", "SJ", "SK", "TF", "TG"],
      ["SA", "SB", "SC", "SD", "SE", "TA", "TB"],
      ["NV", "NW", "NX", "NY", "NZ", "OV", "OW"],
      ["NQ", "NR", "NS", "NT", "NU", "OQ", "OR"],
      ["NL", "NM", "NN", "NO", "NP", "OL", "OM"],
      ["NF", "NG", "NH", "NJ", "NK", "OF", "OG"],
      ["NA", "NB", "NC", "ND", "NE", "OA", "OB"],
    ];

    gridLetters.forEach((row, rowIndex) => {
      row.forEach((code, columnIndex) => {
        const eastings = columnIndex * 100000;
        const northings = rowIndex * 100000;

        it(`should return grid code ${code} for eastings ${eastings} and northings ${northings}`, () => {
          expect(gridCodeFrom(eastings, northings)).toEqual(code);
        });
      });
    });
  });

});
