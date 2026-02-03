import inquirer from "inquirer";
import readline from "readline";

export const BACK = Symbol("BACK");
export const QUIT = Symbol("QUIT");

export type PromptResult<T> = T | typeof BACK | typeof QUIT;

interface SelectOptions<T> {
  message: string;
  choices: { name: string; value: T }[];
  allowBack?: boolean;
}

function getHintText(allowBack: boolean): string {
  return allowBack
    ? "[ESC: back] [q/Ctrl+C: quit]"
    : "[q/Ctrl+C: quit]";
}

export function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

export async function select<T>(options: SelectOptions<T>): Promise<PromptResult<T>> {
  const allowBack = options.allowBack !== false;
  const hint = getHintText(allowBack);

  return new Promise((resolve) => {
    let resolved = false;
    let rawModeWasEnabled = false;

    const cleanup = () => {
      process.stdin.removeListener("keypress", keyHandler);
      if (rawModeWasEnabled && process.stdin.isTTY) {
        try {
          process.stdin.setRawMode(false);
        } catch {}
      }
    };

    const keyHandler = (ch: string, key: readline.Key) => {
      if (resolved) return;
      if (ch === "q") {
        resolved = true;
        cleanup();
        handleQuit();
      }
      if (allowBack && key.name === "escape") {
        resolved = true;
        cleanup();
        console.log();
        resolve(BACK);
      }
    };

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY && !process.stdin.isRaw) {
      rawModeWasEnabled = true;
      process.stdin.setRawMode(true);
    }
    process.stdin.on("keypress", keyHandler);

    const choicesWithHint = [
      ...options.choices,
      new inquirer.Separator(),
      new inquirer.Separator(hint)
    ];

    inquirer
      .prompt([
        {
          type: "list",
          name: "selection",
          message: options.message,
          choices: choicesWithHint,
          pageSize: 15,
          loop: false
        }
      ])
      .then((answers) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(answers.selection);
        }
      })
      .catch(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(QUIT);
        }
      });
  });
}

export async function confirm(message: string, allowBack = true): Promise<PromptResult<boolean>> {
  const hint = getHintText(allowBack);

  return new Promise((resolve) => {
    let resolved = false;
    let rawModeWasEnabled = false;

    const cleanup = () => {
      process.stdin.removeListener("keypress", keyHandler);
      if (rawModeWasEnabled && process.stdin.isTTY) {
        try {
          process.stdin.setRawMode(false);
        } catch {}
      }
    };

    const keyHandler = (ch: string, key: readline.Key) => {
      if (resolved) return;
      if (ch === "q") {
        resolved = true;
        cleanup();
        handleQuit();
      }
      if (allowBack && key.name === "escape") {
        resolved = true;
        cleanup();
        console.log();
        resolve(BACK);
      }
    };

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY && !process.stdin.isRaw) {
      rawModeWasEnabled = true;
      process.stdin.setRawMode(true);
    }
    process.stdin.on("keypress", keyHandler);

    console.log(`\x1b[2m${hint}\x1b[0m`);

    inquirer
      .prompt([
        {
          type: "confirm",
          name: "confirmed",
          message,
          default: false
        }
      ])
      .then((answers) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(answers.confirmed);
        }
      })
      .catch(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(QUIT);
        }
      });
  });
}

export async function input(message: string, allowBack = true): Promise<PromptResult<string>> {
  const hint = getHintText(allowBack);

  return new Promise((resolve) => {
    let resolved = false;
    let rawModeWasEnabled = false;

    const cleanup = () => {
      process.stdin.removeListener("keypress", keyHandler);
      if (rawModeWasEnabled && process.stdin.isTTY) {
        try {
          process.stdin.setRawMode(false);
        } catch {}
      }
    };

    const keyHandler = (ch: string, key: readline.Key) => {
      if (resolved) return;
      if (ch === "q") {
        resolved = true;
        cleanup();
        handleQuit();
      }
      if (allowBack && key.name === "escape") {
        resolved = true;
        cleanup();
        console.log();
        resolve(BACK);
      }
    };

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY && !process.stdin.isRaw) {
      rawModeWasEnabled = true;
      process.stdin.setRawMode(true);
    }
    process.stdin.on("keypress", keyHandler);

    console.log(`\x1b[2m${hint}\x1b[0m`);

    inquirer
      .prompt([
        {
          type: "input",
          name: "value",
          message
        }
      ])
      .then((answers) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(answers.value);
        }
      })
      .catch(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(QUIT);
        }
      });
  });
}

export function isBack(result: unknown): result is typeof BACK {
  return result === BACK;
}

export function isQuit(result: unknown): result is typeof QUIT {
  return result === QUIT;
}

export function handleQuit(): never {
  console.log("\nQuitting...");
  process.exit(0);
}
