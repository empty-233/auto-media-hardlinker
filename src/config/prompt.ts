import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";

const promptFilePath = path.join(process.cwd(), "config", "prompt.md");
const specialFolderPromptFilePath = path.join(process.cwd(), "config", "specialFolderPrompt.md");

let promptCache: string | null = null;
let specialFolderPromptCache: string | null = null;

/**
 * 获取LLM Prompt，优先从缓存读取
 * @returns {string} prompt内容
 */
export function getPrompt(): string {
  if (promptCache) {
    logger.debug("从缓存获取LLM Prompt");
    return promptCache;
  }

  try {
    logger.debug("从文件读取LLM Prompt");
    const prompt = fs.readFileSync(promptFilePath, "utf-8");
    promptCache = prompt;
    return prompt;
  } catch (error) {
    logger.error("读取LLM prompt文件失败", error);
    throw new Error("读取LLM prompt文件失败");
  }
}

/**
 * 获取特殊文件夹识别 Prompt，优先从缓存读取
 * @returns {string} prompt内容
 */
export function getSpecialFolderPrompt(): string {
  if (specialFolderPromptCache) {
    logger.debug("从缓存获取特殊文件夹识别 Prompt");
    return specialFolderPromptCache;
  }

  try {
    logger.debug("从文件读取特殊文件夹识别 Prompt");
    const prompt = fs.readFileSync(specialFolderPromptFilePath, "utf-8");
    specialFolderPromptCache = prompt;
    return prompt;
  } catch (error) {
    logger.error("读取特殊文件夹识别 prompt文件失败", error);
    throw new Error("读取特殊文件夹识别 prompt文件失败");
  }
}

/**
 * 更新LLM Prompt
 * @param {string} newPrompt - 新的prompt内容
 */
export function updatePrompt(newPrompt: string): void {
  try {
    fs.writeFileSync(promptFilePath, newPrompt, "utf-8");
    clearPromptCache(); // 更新后清除缓存
    logger.info("LLM Prompt更新成功");
  } catch (error) {
    logger.error("写入LLM prompt文件失败", error);
    throw new Error("写入LLM prompt文件失败");
  }
}

/**
 * 清除LLM Prompt缓存
 */
export function clearPromptCache(): void {
  promptCache = null;
  specialFolderPromptCache = null;
  logger.info("LLM Prompt缓存已清除");
}