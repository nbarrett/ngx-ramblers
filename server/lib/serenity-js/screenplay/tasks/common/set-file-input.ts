import { AnswersQuestions, Interaction, UsesAbilities } from "@serenity-js/core";
import { Answerable } from "@serenity-js/core/lib/screenplay";
import { PageElement } from "@serenity-js/web";

export class SetFileInput extends Interaction {

  static to(filePath: string) {
    return {
      from: (target: Answerable<PageElement>) => new SetFileInput(filePath, target)
    };
  }

  constructor(private readonly filePath: string, private readonly target: Answerable<PageElement>) {
    super(`#actor uploads file ${filePath} using ${target}`);
  }

  async performAs(actor: UsesAbilities & AnswersQuestions): Promise<void> {
    const element = await actor.answer(this.target);
    const nativeElement = await element.nativeElement();

    await nativeElement.setInputFiles(this.filePath);
  }
}
