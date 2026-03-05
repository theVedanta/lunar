import type {
  Connection,
  DidChangeConfigurationParams,
} from "vscode-languageserver/node";

/**
 * Settings shape for the server.
 *
 * Keep this small and stable; it is the contract between the client config
 * and the server behavior.
 */
export interface ServerSettings {
  maxNumberOfProblems: number;
}

/**
 * Default settings used when the client does not support workspace configuration
 * or when configuration is missing.
 */
export const defaultSettings: ServerSettings = {
  maxNumberOfProblems: 1000,
};

export interface SettingsManager {
  /**
   * Handle a configuration change notification from the client.
   * This is usually called inside `connection.onDidChangeConfiguration(...)`.
   */
  onDidChangeConfiguration(change: DidChangeConfigurationParams): void;

  /**
   * Get the current settings for a given document/resource URI.
   * If the client doesn't support per-resource config, this falls back to global settings.
   */
  getDocumentSettings(resourceUri: string): Thenable<ServerSettings>;

  /**
   * Call when a document is closed to free cached settings.
   */
  onDidCloseDocument(resourceUri: string): void;
}

/**
 * Creates a settings manager that mirrors the original sample's behavior:
 * - If `workspace/configuration` is supported, it caches per-document settings.
 * - Otherwise it uses a global settings object derived from `change.settings`.
 *
 * The `section` should match the configuration section used by your extension/package.
 * In the original sample, this is `"languageServerExample"`.
 */
export function createSettingsManager(params: {
  connection: Connection;
  hasConfigurationCapability: boolean;
  section?: string;
  defaults?: ServerSettings;
}): SettingsManager {
  const {
    connection,
    hasConfigurationCapability,
    section = "languageServerExample",
    defaults = defaultSettings,
  } = params;

  // Global settings used when per-resource config isn't available.
  let globalSettings: ServerSettings = defaults;

  // Cache the settings of all open documents.
  const documentSettings = new Map<string, Thenable<ServerSettings>>();

  function onDidChangeConfiguration(
    change: DidChangeConfigurationParams,
  ): void {
    if (hasConfigurationCapability) {
      // Reset all cached document settings; they will be re-fetched lazily.
      documentSettings.clear();
    } else {
      // When configuration capability isn't present, VS Code sends all settings in this payload.
      // We read from the configured section name if it exists.
      const settingsRecord = change.settings as
        | Record<string, unknown>
        | undefined;
      const sectionValue = settingsRecord?.[section];

      // We accept either a full `ServerSettings` object under the section key,
      // or fall back to defaults if the payload isn't shaped as expected.
      if (typeof sectionValue === "object" && sectionValue !== null) {
        const s = sectionValue as Partial<ServerSettings>;
        globalSettings = {
          maxNumberOfProblems:
            s.maxNumberOfProblems ?? defaults.maxNumberOfProblems,
        };
      } else {
        globalSettings = defaults;
      }
    }

    // Ask the client to refresh diagnostics since settings may impact validation.
    connection.languages.diagnostics.refresh();
  }

  function getDocumentSettings(resourceUri: string): Thenable<ServerSettings> {
    if (!hasConfigurationCapability) {
      return Promise.resolve(globalSettings);
    }

    const existing = documentSettings.get(resourceUri);
    if (existing) {
      return existing;
    }

    const fetched = connection.workspace.getConfiguration({
      scopeUri: resourceUri,
      section,
    }) as Thenable<ServerSettings>;

    documentSettings.set(resourceUri, fetched);
    return fetched;
  }

  function onDidCloseDocument(resourceUri: string): void {
    documentSettings.delete(resourceUri);
  }

  return {
    onDidChangeConfiguration,
    getDocumentSettings,
    onDidCloseDocument,
  };
}
