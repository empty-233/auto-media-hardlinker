import { Response } from "express";
import { FileService } from "../services";
import {
  success,
  notFound,
} from "../utils/response";
import { TypedController, TypedRequest } from "./base.controller";
import { ParamValidators, FileValidators } from "../validators";
import { z } from "zod";

// 类型定义
type IdParamType = z.infer<typeof ParamValidators.id>;
type IdOrNewParamType = z.infer<typeof ParamValidators.idOrNew>;
type DirectoryQueryType = z.infer<typeof FileValidators.getDirectoryContents>;
type RenameFileBodyType = z.infer<typeof FileValidators.renameFile>;
type LinkMediaBodyType = z.infer<typeof FileValidators.linkMedia>;

export class FileController extends TypedController {
  constructor(
    private fileService: FileService
  ) {
    super();
  }

  // 获取目录内容
  getDirectoryContents = this.asyncHandler<{}, DirectoryQueryType>(
    async (req: TypedRequest<{}, DirectoryQueryType>, res: Response) => {
      const { dirPath } = req.query;
      const result = await this.fileService.getDirectoryContents(dirPath);
      success(res, result, "获取目录内容成功");
    }
  );

  // 获取单个文件详情
  getFileById = this.asyncHandler<IdParamType>(
    async (req: TypedRequest<IdParamType>, res: Response) => {
      const { id } = req.params;
      const file = await this.fileService.getFileById(id);

      if (!file) {
        notFound(res, "文件不存在");
        return;
      }

      success(res, file, "获取文件详情成功");
    }
  );

  // 重命名文件
  renameFile = this.asyncHandler<{}, {}, RenameFileBodyType>(
    async (req: TypedRequest<{}, {}, RenameFileBodyType>, res: Response) => {
      const { filePath, newName } = req.body;

      const result = await this.fileService.renameFile(filePath, newName);
      success(res, result, "文件重命名成功");
    }
  );

  // 关联媒体文件 - 使用新的验证器结构
  linkMedia = this.asyncHandler<IdOrNewParamType, {}, LinkMediaBodyType>(
    async (
      req: TypedRequest<IdOrNewParamType, {}, LinkMediaBodyType>,
      res: Response
    ) => {
      // 使用Zod验证和转换后的数据
      const { id: fileId } = req.params;
      const {
        mediaInfo,
        filename,
        path: filePath,
        episodeTmdbId,
        seasonNumber,
        episodeNumber,
        isSpecialFolder,
        parentFolder
      } = req.body;

      const result = await this.fileService.linkMediaToFileProcess(
        fileId,
        mediaInfo,
        filename,
        filePath,
        episodeTmdbId,
        seasonNumber,
        episodeNumber,
        isSpecialFolder,
        parentFolder
      );

      success(res, result, "关联媒体成功");
    }
  );

  // 取消关联媒体文件
  unlinkMedia = this.asyncHandler<IdParamType>(
    async (req: TypedRequest<IdParamType>, res: Response) => {
      const { id: fileId } = req.params;

      const result = await this.fileService.unlinkMediaFromFileProcess(fileId);
      success(res, result, "取消文件关联成功");
    }
  );

  // 更新碟片编号
  updateDiscNumber = this.asyncHandler<IdParamType, {}, z.infer<typeof FileValidators.updateDiscNumber>>(
    async (req: TypedRequest<IdParamType, {}, z.infer<typeof FileValidators.updateDiscNumber>>, res: Response) => {
      const { id: fileId } = req.params;
      const { discNumber } = req.body;

      const result = await this.fileService.updateDiscNumber(fileId, discNumber);
      success(res, result, discNumber === null ? "取消碟片编号成功" : "更新碟片编号成功");
    }
  );
}