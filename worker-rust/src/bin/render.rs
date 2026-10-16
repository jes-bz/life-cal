fn main() {
    let a: Vec<String> = std::env::args().collect();
    let colors = life_cal_worker::config::Config::parse(
        ["bg", "lived", "rest"].iter().enumerate().filter_map(|(i, key)| a.get(6+i).map(|v| (key.to_string(),v.clone())))
    ).unwrap().colors;
    let png = life_cal_worker::render(
        &a[1],
        a[2].parse().unwrap(),
        a[3].parse().unwrap(),
        &a[4],
        colors,
    );
    std::fs::write(&a[5], png).unwrap();
}
