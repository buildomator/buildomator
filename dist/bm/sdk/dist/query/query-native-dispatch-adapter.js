export function createQueryNativeDispatchAdapter(registry, projectDir, ws) {
    return {
        dispatch: (command, args) => registry.dispatch(command, args, projectDir, ws),
    };
}
//# sourceMappingURL=query-native-dispatch-adapter.js.map