import expect from "expect";
import { describe, it } from "mocha";
import { parseChosenImageLabel, s3KeyForCandidate, sampleCandidates } from "./choose-cover-image";

describe("choose-cover-image", () => {
  describe("sampleCandidates", () => {
    it("returns all candidates when under the limit", () => {
      const candidates = [
        {image: "a.jpg", url: "https://example.com/a.jpg"},
        {image: "b.jpg", s3Key: "carousels/album/b.jpg"}
      ];
      expect(sampleCandidates(candidates, 12)).toEqual(candidates);
    });

    it("samples evenly and keeps the last image when over the limit", () => {
      const candidates = Array.from({length: 20}, (_value, index) => ({
        image: `img-${index}.jpg`,
        url: `https://example.com/${index}.jpg`
      }));
      const sampled = sampleCandidates(candidates, 5);
      expect(sampled.length).toEqual(5);
      expect(sampled[0].image).toEqual("img-0.jpg");
      expect(sampled[sampled.length - 1].image).toEqual("img-19.jpg");
    });
  });

  describe("s3KeyForCandidate", () => {
    it("prefers an explicit s3Key", () => {
      expect(s3KeyForCandidate({image: "a.jpg", s3Key: "carousels/album/a.jpg"})).toEqual("carousels/album/a.jpg");
    });

    it("builds a key from root folder, album name and image", () => {
      expect(s3KeyForCandidate({image: "shot.jpg"}, "carousels", "walks/photos/2026/x")).toEqual("carousels/walks/photos/2026/x/shot.jpg");
    });
  });

  describe("parseChosenImageLabel", () => {
    const candidates = [
      {image: "first.jpg", url: "https://example.com/1.jpg"},
      {image: "second.jpg", url: "https://example.com/2.jpg"},
      {image: "third.jpg", url: "https://example.com/3.jpg"}
    ];

    it("parses 1-based IMAGE_n labels", () => {
      expect(parseChosenImageLabel("IMAGE_1", candidates)).toEqual("first.jpg");
      expect(parseChosenImageLabel("IMAGE_2", candidates)).toEqual("second.jpg");
      expect(parseChosenImageLabel("image 3", candidates)).toEqual("third.jpg");
    });

    it("still accepts 0-based labels within range", () => {
      expect(parseChosenImageLabel("IMAGE_0", candidates)).toEqual("first.jpg");
    });

    it("returns null for invalid labels", () => {
      expect(parseChosenImageLabel("none", candidates)).toEqual(null);
      expect(parseChosenImageLabel("IMAGE_9", candidates)).toEqual(null);
    });
  });
});

