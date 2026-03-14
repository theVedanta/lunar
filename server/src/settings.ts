import { Context, Effect, Layer, Ref } from "effect";
import type {
  Connection,
  DidChangeConfigurationParams,
} from "vscode-languageserver/node";

// ---------------------------------------------------------------------------
// Settings shape
// ---------------------------------------------------------------------------

/**
 * Settings shape for the server.
 *
 * Keep this small and stable; it is the contract between the client config
 * and the server behavior.
 */
export interface ServerSettings {
  readonly maxNumberOfProblems: number;
}

/**
 * Default settings used when the client does not support workspace configuration
 * or when configuration is missing.
 */
export const defaultSettings: ServerSettings = {
  maxNumberOfProblems: 1000,
};

// ---------------------------------------------------------------------------
// SettingsManager service interface
// ---------------------------------------------------------------------------

/**
 * The `SettingsManager` service provides access to per-document (or global)
 * settings and handles configuration change notifications from the LSP client.
 *
 * Consumers access it via `yield* SettingsManager`.
 */
export class SettingsManager extends Context.Tag("SettingsManager")<
  SettingsManager,
  {
    /**
     * Handle a configuration change notification from the client.
     * This is usually called inside `connection.onDidChangeConfiguration(...)`.
     */
    readonly onDidChangeConfiguration: (
      change: DidChangeConfigurationParams,
    ) => Effect.Effect<void>;

    /**
     * Get the current settings for a given document/resource URI.
     * If the client doesn't support per-resource config, this falls back to
     * global settings.
     */
    readonly getDocumentSettings: (
      resourceUri: string,
    ) => Effect.Effect<ServerSettings>;

    /**
     * Call when a document is closed to free cached settings.
     */
    readonly onDidCloseDocument: (resourceUri: string) => Effect.Effect<void>;
  }
>() {}

// ---------------------------------------------------------------------------
// Layer construction parameters
// ---------------------------------------------------------------------------

export interface SettingsManagerConfig {
  readonly connection: Connection;
  readonly hasConfigurationCapability: boolean;
  readonly section?: string;
  readonly defaults?: ServerSettings;
}

// ---------------------------------------------------------------------------
// Layer: SettingsManagerLive
// ---------------------------------------------------------------------------

/**
 * Builds a live `SettingsManager` layer.
 *
 * Internally it uses Effect `Ref`s for mutable state (global settings and
 * per-document cache) so that all mutations are tracked within the Effect
 * runtime.
 *
 * Because `Connection` and capability flags are runtime values supplied by the
 * LSP initialization handshake, this is a function that returns a `Layer`
 * rather than a static `Layer` constant.
 */
export const makeSettingsManagerLayer = (
  config: SettingsManagerConfig,
): Layer.Layer<SettingsManager> => {
  const {
    connection,
    hasConfigurationCapability,
    section = "languageServerExample",
    defaults = defaultSettings,
  } = config;

  return Layer.effect(
    SettingsManager,
    Effect.gen(function* () {
      // Global settings ref — used when per-resource config isn't available.
      const globalSettingsRef = yield* Ref.make<ServerSettings>(defaults);

      // Per-document settings cache.
      // Values are `Promise<ServerSettings>` to match the LSP API shape which
      // returns a `Thenable` from `workspace.getConfiguration`.
      const documentSettingsRef = yield* Ref.make<
        Map<string, Promise<ServerSettings>>
      >(new Map());

      // ------------------------------------------------------------------
      // onDidChangeConfiguration
      // ------------------------------------------------------------------
      const onDidChangeConfiguration = (
        change: DidChangeConfigurationParams,
      ): Effect.Effect<void> =>
        Effect.gen(function* () {
          if (hasConfigurationCapability) {
            // Reset all cached document settings; they will be re-fetched lazily.
            yield* Ref.set(documentSettingsRef, new Map());
          } else {
            const settingsRecord = change.settings as
              | Record<string, unknown>
              | undefined;
            const sectionValue = settingsRecord?.[section];

            if (typeof sectionValue === "object" && sectionValue !== null) {
              const s = sectionValue as Partial<ServerSettings>;
              yield* Ref.set(globalSettingsRef, {
                maxNumberOfProblems:
                  s.maxNumberOfProblems ?? defaults.maxNumberOfProblems,
              });
            } else {
              yield* Ref.set(globalSettingsRef, defaults);
            }
          }
        });

      // ------------------------------------------------------------------
      // getDocumentSettings
      // ------------------------------------------------------------------
      const getDocumentSettings = (
        resourceUri: string,
      ): Effect.Effect<ServerSettings> =>
        Effect.gen(function* () {
          if (!hasConfigurationCapability) {
            return yield* Ref.get(globalSettingsRef);
          }

          const cache = yield* Ref.get(documentSettingsRef);
          const existing = cache.get(resourceUri);
          if (existing) {
            return yield* Effect.promise(() => existing);
          }

          // Non-VSCode clients (Neovim, Zed, etc.) return null for unknown
          // configuration sections — normalise to defaults so the server works
          // everywhere, not just in VSCode.
          const fetched = (
            connection.workspace.getConfiguration({
              scopeUri: resourceUri,
              section,
            }) as Promise<ServerSettings | null | undefined>
          ).then((s) => s ?? defaults);

          // Store the normalised promise in the cache
          const newCache = new Map(cache);
          newCache.set(resourceUri, fetched);
          yield* Ref.set(documentSettingsRef, newCache);

          return yield* Effect.promise(() => fetched);
        });

      // ------------------------------------------------------------------
      // onDidCloseDocument
      // ------------------------------------------------------------------
      const onDidCloseDocument = (resourceUri: string): Effect.Effect<void> =>
        Ref.update(documentSettingsRef, (cache) => {
          const newCache = new Map(cache);
          newCache.delete(resourceUri);
          return newCache;
        });

      return {
        onDidChangeConfiguration,
        getDocumentSettings,
        onDidCloseDocument,
      };
    }),
  );
};
