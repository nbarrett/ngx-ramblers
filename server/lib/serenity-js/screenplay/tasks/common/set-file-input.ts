import { AnswersQuestions, Interaction, UsesAbilities } from "@serenity-js/core";
import { Answerable } from "@serenity-js/core/lib/screenplay";
import { PageElement } from "@serenity-js/web";

export class SetFileInput extends Interaction {

  static to(filePaths: string | string[]) {
    return {
      from: (target: Answerable<PageElement>) => new SetFileInput(filePaths, target)
    };
  }

  constructor(private readonly filePaths: string | string[], private readonly target: Answerable<PageElement>) {
    super(`#actor uploads files ${filePaths} using ${target}`);
  }

  async performAs(actor: UsesAbilities & AnswersQuestions): Promise<void> {
    const element = await actor.answer(this.target);
    const nativeElement = await element.nativeElement();

    await nativeElement.setInputFiles(this.filePaths);
  }
}
