fn main() {
    let args: Vec<String> = std::env::args().collect();
    let colors = life_cal_worker::config::Config::parse(
        ["bg", "lived", "rest"]
            .iter()
            .enumerate()
            .filter_map(|(i, key)| args.get(6 + i).map(|v| (key.to_string(), v.clone()))),
    )
    .unwrap()
    .colors;
    let png = life_cal_worker::render(
        &args[1],
        args[2].parse().unwrap(),
        args[3].parse().unwrap(),
        &args[4],
        colors,
    );
    std::fs::write(&args[5], png).unwrap();
}
