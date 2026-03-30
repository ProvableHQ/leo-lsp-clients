program counter.aleo {
    mapping values: address => u64;

    fn increment(account: address) -> u64 {
        let current = Mapping::get_or_use(values, account, 0u64);
        let next = current + 1u64;
        return next;
    }
}

