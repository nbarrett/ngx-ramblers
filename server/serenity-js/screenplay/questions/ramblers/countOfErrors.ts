import { Question, UsesAbilities } from "@serenity-js/core/lib/screenplay";

export class CountOfErrors implements Question<number> {
    constructor(private count: number) {
    }

    static displayed(count): Question<number> {
        return new CountOfErrors(count);
    }

    answeredBy(actor: UsesAbilities): number {
        return this.count;
    }

    toString() {
        return "the count of upload errors";
    }

}
