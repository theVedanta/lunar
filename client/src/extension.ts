import * as path from "path";
import { workspace, ExtensionContext, window, commands } from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js"),
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };

  function getInitOptions(): Record<string, unknown> {
    const config = workspace.getConfiguration("lunar-lsp");
    return {
      openAIApiKey: config.get<string>("openAIApiKey", ""),
      model: config.get<string>("model", "gpt-4.1-mini"),
      maxIssues: config.get<number>("maxIssues", 5),
    };
  }

  const initOptions = getInitOptions();

  if (!initOptions.openAIApiKey) {
    void window
      .showWarningMessage(
        "Lunar: No OpenAI API key configured. Add your key under Settings → Lunar › Open AI Api Key.",
        "Open Settings",
      )
      .then((choice) => {
        if (choice === "Open Settings") {
          void commands.executeCommand(
            "workbench.action.openSettings",
            "lunar.openAIApiKey",
          );
        }
      });
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file" }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
    },
    initializationOptions: initOptions,
  };

  client = new LanguageClient("lunar", "Lunar", serverOptions, clientOptions);
  client.start();

  // When the API key, model, or maxIssues changes, restart the server so the
  // new values are picked up without requiring a window reload.
  context.subscriptions.push(
    workspace.onDidChangeConfiguration(async (e) => {
      if (
        e.affectsConfiguration("lunar.openAIApiKey") ||
        e.affectsConfiguration("lunar.model") ||
        e.affectsConfiguration("lunar.maxIssues")
      ) {
        await client.stop();
        const fresh = getInitOptions();
        Object.assign(clientOptions.initializationOptions as object, fresh);
        client.start();
      }
    }),
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
