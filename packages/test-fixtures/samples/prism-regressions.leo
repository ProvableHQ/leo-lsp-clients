interface ARC20 {
    fn transfer_private(token: dyn record, to: address) -> dyn record;
}

record Foo {
    owner: address,
    data: [u8; 8u32],
}

struct Bar {
    data: [u8; 8u32],
}

program prism_regressions.aleo {
    fn highlight_examples(a: u8) {
        let b: u16 = a as u16;
        let sig: signature = sign195m229jvzr0wmnshj6f8gwplhkrkhjumgjmad553r997u7pjfgpfz4j2w0c9lp53mcqqdsmut2g3a2zuvgst85w38hv273mwjec3sqjsv9w6uglcy58gjh7x3l55z68zsf24kx7a73ctp8x8klhuw7l2p4s3aq8um5jp304js7qcnwdqj56q5r5088tyvxsgektun0rnmvtsuxpe6sj;
        let target: identifier = 'my_program';
        let result: address = SHA3_384::hash_to_address(1u8);
        let s: external_program.aleo::S2 = external_program.aleo::S2 {
            x: 1field,
            y: 2u32,
        };

        let arr_of_structs: [Bar; 2u32] = [Bar { data: 1u8 }, Bar { data: 2u8 }];
        let _ = (b, sig, target, result, s, arr_of_structs);
    }
}
