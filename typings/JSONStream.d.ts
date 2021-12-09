// This is a bit weird, because the JSONStream module has been published to
// npm with a mixed case name. The typescript compiler can't resolve the types 
// correctly if the correct name is used, it only compiles if the module name 
// is lowercase. This cause issues when this module is compiled to an executable 
// with pkg (in the balena-cli project for example), because the module can't be 
// found, due to the casing being inaccurate.
// The simple fix is to simply re-export the type definitions with the correct casing
declare module 'JSONStream' {
    export * from 'jsonstream'
}