import { expect } from "chai";
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
      expect(gridReference6From(600564, 150590)).to.equal("TR005505");
    });

    it("should return 6-digit grid reference for Kingsnorth, Kent", () => {
      expect(gridReference6From(600323, 139147)).to.equal("TR003391");
    });

    it("should return 6-digit grid reference for Bethersden, Kent (TN26 3AL)", () => {
      expect(gridReference6From(592716, 140476)).to.equal("TQ927404");
    });

    it("should return 6-digit grid reference for Bethersden, Kent (TN26 3HF)", () => {
      expect(gridReference6From(589125, 140511)).to.equal("TQ891405");
    });

  });

  describe("gridReference8From", () => {

    it("should return 8-digit grid reference for Challock", () => {
      expect(gridReference8From(600564, 150590)).to.equal("TR00565059");
    });

    it("should return 8-digit grid reference for Kingsnorth, Kent", () => {
      expect(gridReference8From(600323, 139147)).to.equal("TR00323914");
    });

    it("should return 8-digit grid reference for Bethersden, Kent (TN26 3AL)", () => {
      expect(gridReference8From(592716, 140476)).to.equal("TQ92714047");
    });

    it("should return 8-digit grid reference for Bethersden, Kent (TN26 3HF)", () => {
      expect(gridReference8From(589125, 140511)).to.equal("TQ89124051");
    });

  });

  describe("gridReference10From", () => {

    it("should return 10-digit grid reference for Challock", () => {
      expect(gridReference10From(600564, 150590)).to.equal("TR0056450590");
    });

    it("should return 10-digit grid reference for Kingsnorth, Kent", () => {
      expect(gridReference10From(600323, 139147)).to.equal("TR0032339147");
    });

    it("should return 10-digit grid reference for Bethersden, Kent (TN26 3AL)", () => {
      expect(gridReference10From(592716, 140476)).to.equal("TQ9271640476");
    });

    it("should return 10-digit grid reference for Bethersden, Kent (TN26 3HF)", () => {
      expect(gridReference10From(589125, 140511)).to.equal("TQ8912540511");
    });

  });

  describe("gridCodeFrom", () => {

    it("should return grid code for Challock", () => {
      expect(gridCodeFrom(600564, 150590)).to.equal("TR");
    });

    it("should return grid code for Kingsnorth, Kent", () => {
      expect(gridCodeFrom(600323, 139147)).to.equal("TR");
    });

    it("should return grid code for Bethersden, Kent (TN26 3AL)", () => {
      expect(gridCodeFrom(592716, 140476)).to.equal("TQ");
    });

    it("should return grid code for Bethersden, Kent (TN26 3HF)", () => {
      expect(gridCodeFrom(589125, 140511)).to.equal("TQ");
    });

  });

  describe("gridReferenceFrom", () => {

    it("should return grid reference for Kent", () => {
      expect(gridReferenceFrom(589060, 140509)).to.equal("TQ8906040509");
    });

    it("should return grid reference for Scotland", () => {
      expect(gridReferenceFrom(403183, 78709)).to.equal("SZ0318378709");
    });

    it("should return grid reference for London", () => {
      expect(gridReferenceFrom(530000, 180000)).to.equal("TQ3000080000");
    });

    it("should return grid reference for Manchester", () => {
      expect(gridReferenceFrom(384000, 398000)).to.equal("SJ8400098000");
    });

    it("should return grid reference for Birmingham", () => {
      expect(gridReferenceFrom(407000, 286000)).to.equal("SP0700086000");
    });

    it("should return grid reference for Edinburgh", () => {
      expect(gridReferenceFrom(325000, 673000)).to.equal("NT2500073000");
    });

    it("should return grid reference for Cardiff", () => {
      expect(gridReferenceFrom(318000, 176000)).to.equal("ST1800076000");
    });

    it("should return grid reference for Glasgow", () => {
      expect(gridReferenceFrom(258000, 665000)).to.equal("NS5800065000");
    });

    it("should return grid reference for Liverpool", () => {
      expect(gridReferenceFrom(334000, 390000)).to.equal("SJ3400090000");
    });

    it("should return grid reference for Bristol", () => {
      expect(gridReferenceFrom(359000, 172000)).to.equal("ST5900072000");
    });

    it("should return grid reference for Leeds", () => {
      expect(gridReferenceFrom(430000, 433000)).to.equal("SE3000033000");
    });

    it("should return grid reference for Sheffield", () => {
      expect(gridReferenceFrom(435000, 387000)).to.equal("SK3500087000");
    });

    it("should return grid reference for Newcastle", () => {
      expect(gridReferenceFrom(425000, 565000)).to.equal("NZ2500065000");
    });

    it("should return grid reference for Nottingham", () => {
      expect(gridReferenceFrom(457000, 340000)).to.equal("SK5700040000");
    });

    it("should return grid reference for Leicester", () => {
      expect(gridReferenceFrom(488012, 166936)).to.equal("SU8801266936");
    });

    it("should return grid reference for Southampton", () => {
      expect(gridReferenceFrom(442000, 112000)).to.equal("SU4200012000");
    });

    it("should return grid reference for Portsmouth", () => {
      expect(gridReferenceFrom(441982, 111882)).to.equal("SU4198211882");
    });

    it("should return grid reference for Norwich", () => {
      expect(gridReferenceFrom(622977, 308549)).to.equal("TG2297708549");
    });

    it("should return grid reference for Oxford", () => {
      expect(gridReferenceFrom(451000, 206000)).to.equal("SP5100006000");
    });

    it("should return grid reference for Cambridge", () => {
      expect(gridReferenceFrom(545000, 258000)).to.equal("TL4500058000");
    });

    it("should return grid reference for Exeter", () => {
      expect(gridReferenceFrom(291914, 92560)).to.equal("SX9191492560");
    });

    it("should return grid reference for Plymouth", () => {
      expect(gridReferenceFrom(247764, 54429)).to.equal("SX4776454429");
    });

    it("should return grid reference for Derby", () => {
      expect(gridReferenceFrom(435000, 336000)).to.equal("SK3500036000");
    });

    it("should return grid reference for Stoke-on-Trent", () => {
      expect(gridReferenceFrom(388000, 346000)).to.equal("SJ8800046000");
    });

    it("should return grid reference for Coventry", () => {
      expect(gridReferenceFrom(433000, 278000)).to.equal("SP3300078000");
    });

    it("should return grid reference for Reading", () => {
      expect(gridReferenceFrom(471000, 173000)).to.equal("SU7100073000");
    });

    it("should return grid reference for Luton", () => {
      expect(gridReferenceFrom(509000, 222000)).to.equal("TL0900022000");
    });

    it("should return grid reference for Milton Keynes", () => {
      expect(gridReferenceFrom(486000, 238000)).to.equal("SP8600038000");
    });

    it("should return grid reference for Aberdeen", () => {
      expect(gridReferenceFrom(394000, 806000)).to.equal("NJ9400006000");
    });

    it("should return grid reference for Dundee", () => {
      expect(gridReferenceFrom(340000, 730000)).to.equal("NO4000030000");
    });

    it("should return grid reference for Inverness", () => {
      expect(gridReferenceFrom(266000, 845000)).to.equal("NH6600045000");
    });

    it("should return grid reference for Swansea", () => {
      expect(gridReferenceFrom(265000, 193000)).to.equal("SS6500093000");
    });

    it("should return grid reference for Newport", () => {
      expect(gridReferenceFrom(330000, 188000)).to.equal("ST3000088000");
    });

    it("should return grid reference for Wrexham", () => {
      expect(gridReferenceFrom(333000, 350000)).to.equal("SJ3300050000");
    });

    it("should return grid reference for Bangor", () => {
      expect(gridReferenceFrom(258000, 372000)).to.equal("SH5800072000");
    });

    it("should return grid reference for Chester", () => {
      expect(gridReferenceFrom(340000, 366000)).to.equal("SJ4000066000");
    });

    it("should return grid reference for Carlisle", () => {
      expect(gridReferenceFrom(340000, 556000)).to.equal("NY4000056000");
    });

    it("should return grid reference for Durham", () => {
      expect(gridReferenceFrom(427000, 542000)).to.equal("NZ2700042000");
    });

    it("should return grid reference for Lancaster", () => {
      expect(gridReferenceFrom(347000, 461000)).to.equal("SD4700061000");
    });

    it("should return grid reference for York", () => {
      expect(gridReferenceFrom(460000, 451000)).to.equal("SE6000051000");
    });

    it("should return grid reference for Bath", () => {
      expect(gridReferenceFrom(375000, 164000)).to.equal("ST7500064000");
    });

    it("should return grid reference for Cheltenham", () => {
      expect(gridReferenceFrom(394000, 222000)).to.equal("SO9400022000");
    });

    it("should return grid reference for Gloucester", () => {
      expect(gridReferenceFrom(383000, 218000)).to.equal("SO8300018000");
    });

    it("should return grid reference for Worcester", () => {
      expect(gridReferenceFrom(385000, 255000)).to.equal("SO8500055000");
    });

    it("should return grid reference for Hereford", () => {
      expect(gridReferenceFrom(350000, 240000)).to.equal("SO5000040000");
    });

    it("should return grid reference for Shrewsbury", () => {
      expect(gridReferenceFrom(349000, 312000)).to.equal("SJ4900012000");
    });

    it("should return grid reference for Challock", () => {
      expect(gridReferenceFrom(600564, 150590)).to.equal("TR0056450590");
    });

    it("should return grid reference for Kingsnorth, Kent", () => {
      expect(gridReferenceFrom(600323, 139147)).to.equal("TR0032339147");
    });

    it("should return grid reference for Bethersden, Kent (TN26 3AL)", () => {
      expect(gridReferenceFrom(592716, 140476)).to.equal("TQ9271640476");
    });

    it("should return grid reference for Bethersden, Kent (TN26 3HF)", () => {
      expect(gridReferenceFrom(589125, 140511)).to.equal("TQ8912540511");
    });

    it("should return grid reference for Shalloak Road, Kent (CT2 0PS)", () => {
      expect(gridReferenceFrom(616745, 160390)).to.equal("TR1674560390");
    });
  });

  describe("gridCodeFrom", () => {

    it("should return grid code for Kent", () => {
      expect(gridCodeFrom(589060, 140509)).to.equal("TQ");
    });

    it("should return grid code for Scotland", () => {
      expect(gridCodeFrom(403183, 78709)).to.equal("SZ");
    });

    it("should return grid code for London", () => {
      expect(gridCodeFrom(530000, 180000)).to.equal("TQ");
    });

    it("should return grid code for Manchester", () => {
      expect(gridCodeFrom(384000, 398000)).to.equal("SJ");
    });

    it("should return grid code for Birmingham", () => {
      expect(gridCodeFrom(407000, 286000)).to.equal("SP");
    });

    it("should return grid code for Edinburgh", () => {
      expect(gridCodeFrom(325000, 673000)).to.equal("NT");
    });

    it("should return grid code for Cardiff", () => {
      expect(gridCodeFrom(318000, 176000)).to.equal("ST");
    });

    it("should return grid code for Belfast", () => {
      expect(gridCodeFrom(146230, 529459)).to.equal("NW");
    });

    it("should return grid code for Glasgow", () => {
      expect(gridCodeFrom(258000, 665000)).to.equal("NS");
    });

    it("should return grid code for Liverpool", () => {
      expect(gridCodeFrom(334000, 390000)).to.equal("SJ");
    });

    it("should return grid code for Bristol", () => {
      expect(gridCodeFrom(359000, 172000)).to.equal("ST");
    });

    it("should return grid code for Leeds", () => {
      expect(gridCodeFrom(430000, 433000)).to.equal("SE");
    });

    it("should return grid code for Sheffield", () => {
      expect(gridCodeFrom(435000, 387000)).to.equal("SK");
    });

    it("should return grid code for Newcastle", () => {
      expect(gridCodeFrom(425000, 565000)).to.equal("NZ");
    });

    it("should return grid code for Nottingham", () => {
      expect(gridCodeFrom(457000, 340000)).to.equal("SK");
    });

    it("should return grid code for Leicester", () => {
      expect(gridCodeFrom(488012, 166936)).to.equal("SU");
    });

    it("should return grid code for Southampton", () => {
      expect(gridCodeFrom(442000, 112000)).to.equal("SU");
    });

    it("should return grid code for Portsmouth", () => {
      expect(gridCodeFrom(441982, 111882)).to.equal("SU");
    });

    it("should return grid code for Norwich", () => {
      expect(gridCodeFrom(622977, 308549)).to.equal("TG");
    });

    it("should return grid code for Oxford", () => {
      expect(gridCodeFrom(451000, 206000)).to.equal("SP");
    });

    it("should return grid code for Cambridge", () => {
      expect(gridCodeFrom(545000, 258000)).to.equal("TL");
    });

    it("should return grid code for Challock", () => {
      expect(gridCodeFrom(600564, 150590)).to.equal("TR");
    });

    it("should return grid code for Kingsnorth, Kent", () => {
      expect(gridCodeFrom(600323, 139147)).to.equal("TR");
    });

    it("should return grid code for Bethersden, Kent (TN26 3AL)", () => {
      expect(gridCodeFrom(592716, 140476)).to.equal("TQ");
    });

    it("should return grid code for Bethersden, Kent (TN26 3HF)", () => {
      expect(gridCodeFrom(589125, 140511)).to.equal("TQ");
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
          expect(gridCodeFrom(eastings, northings)).to.equal(code);
        });
      });
    });
  });

});
