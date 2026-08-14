/**
 * Declarative stack-detection signature table.
 * Each entry describes what files/deps/content to look for, and what to emit.
 */
export interface StackSignature {
    /** Unique stack identifier matched against STACK_NAMES */
    type: string;
    /**
     * If provided, the signature is only considered when the given manifest file
     * exists in the target directory.
     */
    manifestFile?: string;
    /**
     * For package.json-based stacks: list of dep keys (any match triggers).
     * Checked against `{ ...dependencies, ...devDependencies }`.
     */
    packageDeps?: string[];
    /**
     * For text-based manifests (requirements.txt, pyproject.toml, go.mod, …):
     * list of substrings. Any one match triggers.
     */
    contentIncludes?: string[];
    /**
     * Optional custom predicate — runs after file existence/dep/content checks.
     * Receives the directory and (for package.json stacks) the merged deps object.
     * Return true to confirm detection.
     */
    predicate?: (dir: string, deps: Record<string, string>) => boolean;
}
export interface CapabilitySignature {
    capability: string;
    /** package.json dep keys — any match */
    packageDeps?: string[];
    /** Content substrings for non-JS manifests — any match */
    contentIncludes?: string[];
    /** Optional extra guard — all of deps/content must also match */
    requiresDirs?: string[];
}
export interface DatabaseSignature {
    name: string;
    packageDeps?: string[];
    contentIncludes?: string[];
}
export interface StateManagementSignature {
    name: string;
    packageDeps?: string[];
    contentIncludes?: string[];
}
export declare const NODE_STACK_SIGNATURES: StackSignature[];
export declare const PYTHON_STACK_SIGNATURES: StackSignature[];
/** Single-file manifests that map 1-to-1 to a stack type */
export declare const FILE_MANIFEST_STACKS: StackSignature[];
/** Gradle-based JVM stacks */
export declare const GRADLE_STACK_SIGNATURES: StackSignature[];
/** Maven pom.xml stacks */
export declare const MAVEN_STACK_SIGNATURES: StackSignature[];
/** Swift/iOS — requires Package.swift OR Xcode project files */
export declare const SWIFT_STACK_SIGNATURES: StackSignature[];
/** Ruby — Gemfile with "rails" keyword */
export declare const RUBY_STACK_SIGNATURES: StackSignature[];
/** C# / Unity — requires .csproj/.sln AND Unity-specific indicators */
export declare const CSHARP_STACK_SIGNATURES: StackSignature[];
/** GDScript / Godot */
export declare const GODOT_STACK_SIGNATURES: StackSignature[];
export declare const DATABASE_SIGNATURES: DatabaseSignature[];
export declare const STATE_MANAGEMENT_SIGNATURES: StateManagementSignature[];
export declare const CAPABILITY_SIGNATURES: CapabilitySignature[];
export declare const HOSTING_SIGNATURES: Array<{
    name: string;
    files: string[];
}>;
export declare const CICD_SIGNATURES: Array<{
    name: string;
    files: string[];
}>;
//# sourceMappingURL=signatures.d.ts.map