// 定义和导出正则表达式配置

export const regexConfig = {
  suffixPatterns: [
    /\[.*?\]/g, // 移除 [1080p] 等
    /\(.*?\)/g, // 移除 (BluRay) 等
    /\d{3,4}p/g, // 移除分辨率
    /x26[45]/g, // 移除 x264/x265
    /\.(mkv|mp4|avi)/g, // 移除文件扩展名
  ],

  // 标题匹配，支持更多番剧特有命名格式
  TitleRegExps: [
    // 优先处理带"SxxExx"季集标识的格式
    /^(?<title>.+?)\s+S\d+E\d+\b/i,
    // 新增：标题 第X季 - 直接提取标题和季数
    /^(?<title>.+?)\s+第(?<season>[一二三四五六七八九十]+)季/,
    // 新增：标题 第X季 第Y话/集
    /^(?<title>.+?)\s+第(?<season>[一二三四五六七八九十]+)季\s+第(?<episode>\d+)[話话集]/,
    // 新增：精确匹配 [SubGroup] Title [Episode(1-2位数)] [技术信息]
    /^\[(?<subgroup>[^\]]+)\]\s*(?<title>.+?)\s*\[(?<episode>\d{1,2})\](?:\s*\[[^\]]+\])+/,
    // 新增：[SubGroup] Title [Episode][技术信息]
    /^\[(?<subgroup>[^\]]+)\]\s*(?<title>.+?)\s*\[(?<episode>\d+)\](?:\[.+?\])+/,
    // 模式 1： [SubGroup] Title - Episode
    /^\[(?<subgroup>[^\]]+)\]\s*(?<title>.+?)\s*-\s*(?<episode>\d+)/,
    // 模式 2： Title - Episode [SubGroup]
    /(?<title>.+?)\s*-\s*(?<episode>\d+)\s*\[(?<subgroup>[^\]]+)\]/,
    // 模式 3： Title Episode
    /(?<title>.+?)\s+(?<episode>\d+)/,
    // 模式 4： Title SSeason - Episode
    /(?<title>.+?)\s+S(?<season>\d+)\s*-\s*(?<episode>\d+)/,
    // 模式 5： [SubGroup] Title [Episode]
    /^\[(?<subgroup>[^\]]+)\]\s*(?<title>.+?)\s*\[(?<episode>\d+)\]/,
    // 模式 6： 处理年份 [SubGroup] Title (Year) - Episode
    /^\[(?<subgroup>[^\]]+)\]\s*(?<title>.+?)\s*\((?<year>\d{4})\)\s*-\s*(?<episode>\d+)/,
  ],

  // 文件夹标题提取的正则表达式
  FolderTitleRegExps: [
    // 模式 1: [BDMV][日期][编号][标题][版本]
    /\[BDMV\](?:\[\d+\])?(?:\[[^\]]+\])?\[(?<title>[^\]]+)\](?:\[[^\]]+\])?/,
    // 模式 2: [BDMV] 标题
    /\[BDMV\]\s+(?<title>.+?)(?:\s+\[|\s*$)/,
    // 模式 3: 标题 (年份)
    /^(?<title>.+?)\s+\((?<year>\d{4})\)/,
    // 模式 4: 标题 第X季 - 直接提取标题和季数
    /^(?<title>.+?)\s+第(?<season>[一二三四五六七八九十]+)季$/,
    // 模式 5: 标题（无任何修饰）
    /^(?<title>[^[]+?)$/,
    // 模式 6: [SubGroup] 标题
    /^\[(?<subgroup>[^\]]+)\]\s*(?<title>.+?)(?:\s+\[|\s*$)/,
  ],

  // 季数匹配
  seasonRegexps: [
    /S(\d{1,2})(?!eason)/i, // 匹配 S01
    /season\s+(\d{1,2})/i, // 匹配 season 1
    /Season\s+(\d{1,2})/i, // 匹配 Season 1
    /第([一二三四五六七八九十百千\d]+)[季]/, // 匹配中文季数表示，包括"期"
    /(\d+)(?:nd|rd|th)\s+Season/i, // 匹配 2nd Season, 3rd Season
    /Part\s+(\d+)/i, // 匹配 Part 2
    /続編|新系列/, // 匹配续编/新系列（视为第二季）
  ],

  // 集数匹配
  episodeRegexps: [
    /- (\d{1,3}(?:\.\d+)?)/i, // 匹配 01, 01.5
    /E(\d{1,3}(?:\.\d+)?)/i, // 匹配 E01, E01.5
    /EP(\d{1,3}(?:\.\d+)?)/i, // 匹配 EP01, EP01.5
    /episode\s+(\d{1,2})/i, // 匹配 season 1
    /Episode\s+(\d{1,2})/i, // 匹配 Season 1
    /第(\d{1,3}(?:\.\d+)?)([話话集])?/, // 匹配 第01话、第01集、第01.5话
    /\[(\d{1,3}(?:\.\d+)?)(?:v\d)?\]/, // 匹配 [01]、[01v2]、[01.5]
    /SP(\d{1,2})/, // 匹配 SP01（特别篇）
  ],

  // 添加用于识别特殊类型的正则表达式
  specialTypeRegexps: [
    /\bOVA\b/i, // 原创动画录像带
    /\bSP\d*\b/i, // 特别篇
    /\b剧场版\b|Theatrical/i, // 剧场版
    /\b完结篇\b|END/i, // 完结篇
    /\bSpecial\b/i, // 特别篇英文表示
  ],
};

export type RegexConfigType = typeof regexConfig;
