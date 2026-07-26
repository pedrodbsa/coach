export { PluginFactory } from "./factory.ts";
export {
    assertMandatoryNamespaces,
    isPluginKey,
    MANDATORY_NAMESPACES,
    PLUGIN_REGISTRY,
    pluginVerb,
    pluginVerbs,
    registeredPluginKeys,
    resolveActivePlugins,
} from "./registry.ts";
export type { PluginKey, RegisteredPlugin } from "./registry.ts";
export type {
    DomainFunction,
    DomainPlugin,
    DomainResult,
    DomainSummary,
    IPlugin,
    IPluginFactory,
    JsonFact,
    PluginDefinition,
    PluginFactoryBuilder,
} from "./types.ts";
