import two_file_add.aleo;

program two_file_main.aleo {
    fn run(x: u64, y: u64) -> u64 {
        let result: u64 = two_file_add.aleo::add(x, y);
        return result;
    }
}
