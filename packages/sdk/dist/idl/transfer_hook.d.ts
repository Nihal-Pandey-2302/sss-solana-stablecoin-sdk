/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/transfer_hook.json`.
 */
export type TransferHook = {
    "address": "DyHpthHQhvcuywjyV4nBjpEZbM1PfP71wAn84nkVshUy";
    "metadata": {
        "name": "transferHook";
        "version": "0.1.0";
        "spec": "0.1.0";
        "description": "Created with Anchor";
    };
    "instructions": [
        {
            "name": "initializeExtraAccountMetaList";
            "discriminator": [
                92,
                197,
                174,
                197,
                41,
                124,
                19,
                3
            ];
            "accounts": [
                {
                    "name": "payer";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "extraAccountMetaList";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    101,
                                    120,
                                    116,
                                    114,
                                    97,
                                    45,
                                    97,
                                    99,
                                    99,
                                    111,
                                    117,
                                    110,
                                    116,
                                    45,
                                    109,
                                    101,
                                    116,
                                    97,
                                    115
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "mint";
                            }
                        ];
                    };
                },
                {
                    "name": "mint";
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [];
        }
    ];
};
