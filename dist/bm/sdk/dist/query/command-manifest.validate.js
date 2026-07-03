/**
 * Canonical validate.* command manifest.
 */
export const VALIDATE_COMMAND_MANIFEST = [
    { family: 'validate', canonical: 'validate.consistency', aliases: ['validate consistency'], mutation: false, outputMode: 'json' },
    { family: 'validate', canonical: 'validate.health', aliases: ['validate health'], mutation: false, outputMode: 'json' },
    { family: 'validate', canonical: 'validate.agents', aliases: ['validate agents'], mutation: false, outputMode: 'json' },
    { family: 'validate', canonical: 'validate.context', aliases: ['validate context'], mutation: false, outputMode: 'json' },
];
//# sourceMappingURL=command-manifest.validate.js.map