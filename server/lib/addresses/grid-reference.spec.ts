import { expect } from "chai";
import { gridReferenceFrom, gridCodeFrom } from "./grid-reference";

describe("Grid Reference Functions", () => {

  describe("gridReferenceFrom", () => {

    it("should return grid reference for Kent", () => {
      expect(gridReferenceFrom(589060, 140509)).to.equal("TQ 89060 40509");
    });


    it("should return grid reference for Scotland", () => {
      expect(gridReferenceFrom(403183, 78709)).to.equal("SZ 03183 78709");
    });

    it("should return grid reference for London", () => {
      expect(gridReferenceFrom(530000, 180000)).to.equal("TQ 30000 80000");
    });

    it("should return grid reference for Manchester", () => {
      expect(gridReferenceFrom(384000, 398000)).to.equal("SJ 84000 98000");
    });

    it("should return grid reference for Birmingham", () => {
      expect(gridReferenceFrom(407000, 286000)).to.equal("SP 07000 86000");
    });

    it("should return grid reference for Edinburgh", () => {
      expect(gridReferenceFrom(325000, 673000)).to.equal("NT 25000 73000");
    });

    it("should return grid reference for Cardiff", () => {
      expect(gridReferenceFrom(318000, 176000)).to.equal("ST 18000 76000");
    });

    it("should return grid reference for Glasgow", () => {
      expect(gridReferenceFrom(258000, 665000)).to.equal("NS 58000 65000");
    });

    it("should return grid reference for Liverpool", () => {
      expect(gridReferenceFrom(334000, 390000)).to.equal("SJ 34000 90000");
    });

    it("should return grid reference for Bristol", () => {
      expect(gridReferenceFrom(359000, 172000)).to.equal("ST 59000 72000");
    });

    it("should return grid reference for Leeds", () => {
      expect(gridReferenceFrom(430000, 433000)).to.equal("SE 30000 33000");
    });

    it("should return grid reference for Sheffield", () => {
      expect(gridReferenceFrom(435000, 387000)).to.equal("SK 35000 87000");
    });

    it("should return grid reference for Newcastle", () => {
      expect(gridReferenceFrom(425000, 565000)).to.equal("NZ 25000 65000");
    });

    it("should return grid reference for Nottingham", () => {
      expect(gridReferenceFrom(457000, 340000)).to.equal("SK 57000 40000");
    });

    it("should return grid reference for Leicester", () => {
      expect(gridReferenceFrom(488012, 166936)).to.equal("SU 88012 66936");
    });

    it("should return grid reference for Southampton", () => {
      expect(gridReferenceFrom(442000, 112000)).to.equal("SU 42000 12000");
    });

    it("should return grid reference for Portsmouth", () => {
      expect(gridReferenceFrom(441982, 111882)).to.equal("SU 41982 11882");
    });

    it("should return grid reference for Norwich", () => {
      expect(gridReferenceFrom(622977, 308549)).to.equal("TG 22977 08549");
    });

    it("should return grid reference for Oxford", () => {
      expect(gridReferenceFrom(451000, 206000)).to.equal("SP 51000 06000");
    });

    it("should return grid reference for Cambridge", () => {
      expect(gridReferenceFrom(545000, 258000)).to.equal("TL 45000 58000");
    });

    it("should return grid reference for Exeter", () => {
      expect(gridReferenceFrom(291914, 92560)).to.equal("SX 91914 92560");
    });

    it("should return grid reference for Plymouth", () => {
      expect(gridReferenceFrom(247764, 54429)).to.equal("SX 47764 54429");
    });

    it("should return grid reference for Derby", () => {
      expect(gridReferenceFrom(435000, 336000)).to.equal("SK 35000 36000");
    });

    it("should return grid reference for Stoke-on-Trent", () => {
      expect(gridReferenceFrom(388000, 346000)).to.equal("SJ 88000 46000");
    });

    it("should return grid reference for Coventry", () => {
      expect(gridReferenceFrom(433000, 278000)).to.equal("SP 33000 78000");
    });

    it("should return grid reference for Reading", () => {
      expect(gridReferenceFrom(471000, 173000)).to.equal("SU 71000 73000");
    });

    it("should return grid reference for Luton", () => {
      expect(gridReferenceFrom(509000, 222000)).to.equal("TL 09000 22000");
    });

    it("should return grid reference for Milton Keynes", () => {
      expect(gridReferenceFrom(486000, 238000)).to.equal("SP 86000 38000");
    });

    it("should return grid reference for Aberdeen", () => {
      expect(gridReferenceFrom(394000, 806000)).to.equal("NJ 94000 06000");
    });

    it("should return grid reference for Dundee", () => {
      expect(gridReferenceFrom(340000, 730000)).to.equal("NO 40000 30000");
    });

    it("should return grid reference for Inverness", () => {
      expect(gridReferenceFrom(266000, 845000)).to.equal("NH 66000 45000");
    });

    it("should return grid reference for Swansea", () => {
      expect(gridReferenceFrom(265000, 193000)).to.equal("SS 65000 93000");
    });

    it("should return grid reference for Newport", () => {
      expect(gridReferenceFrom(330000, 188000)).to.equal("ST 30000 88000");
    });

    it("should return grid reference for Wrexham", () => {
      expect(gridReferenceFrom(333000, 350000)).to.equal("SJ 33000 50000");
    });

    it("should return grid reference for Bangor", () => {
      expect(gridReferenceFrom(258000, 372000)).to.equal("SH 58000 72000");
    });

    it("should return grid reference for Chester", () => {
      expect(gridReferenceFrom(340000, 366000)).to.equal("SJ 40000 66000");
    });

    it("should return grid reference for Carlisle", () => {
      expect(gridReferenceFrom(340000, 556000)).to.equal("NY 40000 56000");
    });

    it("should return grid reference for Durham", () => {
      expect(gridReferenceFrom(427000, 542000)).to.equal("NZ 27000 42000");
    });

    it("should return grid reference for Lancaster", () => {
      expect(gridReferenceFrom(347000, 461000)).to.equal("SD 47000 61000");
    });

    it("should return grid reference for York", () => {
      expect(gridReferenceFrom(460000, 451000)).to.equal("SE 60000 51000");
    });

    it("should return grid reference for Bath", () => {
      expect(gridReferenceFrom(375000, 164000)).to.equal("ST 75000 64000");
    });

    it("should return grid reference for Cheltenham", () => {
      expect(gridReferenceFrom(394000, 222000)).to.equal("SO 94000 22000");
    });

    it("should return grid reference for Gloucester", () => {
      expect(gridReferenceFrom(383000, 218000)).to.equal("SO 83000 18000");
    });

    it("should return grid reference for Worcester", () => {
      expect(gridReferenceFrom(385000, 255000)).to.equal("SO 85000 55000");
    });

    it("should return grid reference for Hereford", () => {
      expect(gridReferenceFrom(350000, 240000)).to.equal("SO 50000 40000");
    });

    it("should return grid reference for Shrewsbury", () => {
      expect(gridReferenceFrom(349000, 312000)).to.equal("SJ 49000 12000");
    });

    it("should return grid reference for Challock", () => {
      expect(gridReferenceFrom(600564, 150590)).to.equal("TR 00564 50590");
    });

    it("should return grid reference for Kingsnorth, Kent", () => {
      expect(gridReferenceFrom(600323, 139147)).to.equal("TR 00323 39147");
    });

    it("should return grid reference for Bethersden, Kent (TN26 3AL)", () => {
      expect(gridReferenceFrom(592716, 140476)).to.equal("TQ 92716 40476");
    });

    it("should return grid reference for Bethersden, Kent (TN26 3HF)", () => {
      expect(gridReferenceFrom(589125, 140511)).to.equal("TQ 89125 40511");
    });

    it("should return grid reference for Shalloak Road, Kent (CT2 0PS)", () => {
      expect(gridReferenceFrom(616745, 160390)).to.equal("TR 16745 60390");
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
