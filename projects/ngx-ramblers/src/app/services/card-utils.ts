export const CARD_MARGIN_BOTTOM = "mb-4";

export function cardClasses(slideCount: number, marginBottom: string = "") {
  switch (slideCount) {
    case 8:
      return (marginBottom + " col-sm-12 col-md-6 col-lg-4 col-xl-3").trim();
    case 4:
      return (marginBottom + " col-sm-12 col-md-6 col-lg-4 col-xl-3").trim();
    case 3:
      return (marginBottom + " col-sm-12 col-md-6 col-lg-4 col-xl-4").trim();
    case 2:
      return (marginBottom + " col-sm-12 col-md-6 col-lg-6 col-xl-6").trim();
    case 1:
      return (marginBottom + " col-sm-12").trim();
    default :
      return (marginBottom + " col-sm-12 col-md-6 col-lg-4 col-xl-3").trim();
  }
}


