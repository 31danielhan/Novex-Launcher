//! Turns the game's stdout into readable lines.
//!
//! Mojang's logging configs (which also carry the Log4Shell fix) print log4j XML events
//! meant for launchers. This parser flattens each event into "[thread/LEVEL]: message".

#[derive(Default)]
pub struct Log4jParser {
    event: Option<Event>,
}

struct Event {
    level: String,
    thread: String,
    text: String,
    in_cdata: bool,
}

pub struct Line {
    pub text: String,
    pub level: Option<String>,
}

fn attr(line: &str, name: &str) -> String {
    let key = format!("{name}=\"");
    line.find(&key)
        .map(|i| &line[i + key.len()..])
        .and_then(|rest| rest.find('"').map(|j| rest[..j].to_string()))
        .unwrap_or_default()
}

impl Log4jParser {
    pub fn feed(&mut self, line: &str) -> Option<Line> {
        let Some(ev) = &mut self.event else {
            if line.trim_start().starts_with("<log4j:Event") {
                self.event = Some(Event {
                    level: attr(line, "level"),
                    thread: attr(line, "thread"),
                    text: String::new(),
                    in_cdata: false,
                });
                return None;
            }
            // Plain output (old versions, Java errors) passes through.
            return Some(Line {
                text: line.to_string(),
                level: None,
            });
        };

        if ev.in_cdata {
            match line.find("]]>") {
                Some(end) => {
                    ev.text.push_str(&line[..end]);
                    ev.in_cdata = false;
                }
                None => {
                    ev.text.push_str(line);
                    ev.text.push('\n');
                }
            }
            return None;
        }

        let trimmed = line.trim();
        if trimmed.starts_with("</log4j:Event>") {
            let ev = self.event.take()?;
            return Some(Line {
                text: format!("[{}/{}]: {}", ev.thread, ev.level, ev.text.trim_end()),
                level: Some(ev.level),
            });
        }
        if let Some(start) = trimmed.find("<![CDATA[") {
            if !ev.text.is_empty() {
                ev.text.push('\n');
            }
            let rest = &trimmed[start + "<![CDATA[".len()..];
            match rest.find("]]>") {
                Some(end) => ev.text.push_str(&rest[..end]),
                None => {
                    ev.text.push_str(rest);
                    ev.text.push('\n');
                    ev.in_cdata = true;
                }
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flattens_events_and_passes_plain_lines() {
        let mut p = Log4jParser::default();
        let input = [
            r#"<log4j:Event logger="net.minecraft.client.Minecraft" timestamp="1" level="INFO" thread="Render thread">"#,
            "  <log4j:Message><![CDATA[Setting user: Steve]]></log4j:Message>",
            "</log4j:Event>",
            "plain line",
            r#"<log4j:Event logger="x" timestamp="2" level="ERROR" thread="main">"#,
            "  <log4j:Message><![CDATA[first",
            "second]]></log4j:Message>",
            "</log4j:Event>",
        ];
        let out: Vec<String> = input
            .iter()
            .filter_map(|l| p.feed(l))
            .map(|l| l.text)
            .collect();
        assert_eq!(
            out,
            [
                "[Render thread/INFO]: Setting user: Steve",
                "plain line",
                "[main/ERROR]: first\nsecond",
            ]
        );
    }
}
