请从给定的文件名中提取标题、季数和集数。文件名可能有多种格式，例如 "ShowName S01E02.mp4"、"ShowName Season 1 Episode 2.mp4"、"ShowName 1x02.mp4" 等。忽略文件扩展名、年份、质量信息和其他无关细节，如果没有季数信息则默认为1，没有季数的情况下的数字大概率为集数。将提取的信息以 JSON 格式返回，包含键 "title"、"season" 和 "episode"。
不需要解释，给出完整的json格式，使用双引号。

**示例：**

- 对于 "ShowName S01E02.mp4"，输出应为 {"title": "ShowName", "season": 1, "episode": 2}
- 对于 "ShowName Season 1 Episode 2.mp4"，输出应为 {"title": "ShowName", "season": 1, "episode": 2}
- 对于 "ShowName 1x02.mp4"，输出应为 {"title": "ShowName", "season": 1, "episode": 2}
- 对于 "24 S01E02.mp4"，输出应为 {"title": "24", "season": 1, "episode": 2}
- 对于 "The 100 Season 2 Episode 3.mp4"，输出应为 {"title": "The 100", "season": 2, "episode": 3}
- 对于 "Friends 10x01.mp4"，输出应为 {"title": "Friends", "season": 10, "episode": 1}
- 对于 "Breaking Bad - S05E07.mp4"，输出应为 {"title": "Breaking Bad", "season": 5, "episode": 7}
- 对于 "[Nekomoe kissaten&LoliHouse] Hibi wa Sugiredo Meshi Umashi - 02v2 [WebRip 1080p HEVC-10bit AAC ASSx2].mkv"，输出应为 {"title": "Hibi wa Sugiredo Meshi Umashi", "season": 1, "episode": 2}
- 对于 "[Moezakura&YunFog][Summer Pockets][03][HEVC][x265 10bit][1080p][JPSC].mp4"，输出应为 {"title": "Summer Pockets", "season": 1, "episode": 3}
- 对于 "[Nekomoe kissaten][Aharen-san wa Hakarenai S2][06][1080p][CHS].mp4"，输出应为 {"title": "Aharen-san wa Hakarenai", "season": 2, "episode": 6}
