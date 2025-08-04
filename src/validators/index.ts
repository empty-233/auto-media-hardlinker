/**
 * 验证器模块导出
 * 
 * 这个文件统一导出所有验证器，便于在其他模块中使用
 */

// 通用验证器
export {
  CommonValidators,
  ParamValidators,
  QueryValidators
} from './common.validator';

// 文件相关验证器
export {
  FileValidators,
  FileParamValidators,
  FileValidationRules
} from './file.validator';

// 剧集相关验证器
export {
  EpisodeValidators,
  EpisodeParamValidators,
  EpisodeQueryValidators,
  EpisodeModelValidators
} from './episode.validator';

// 媒体相关验证器
export {
  MediaValidators,
  MediaParamValidators,
  MediaQueryValidators,
  MediaModelValidators
} from './media.validator';

// TMDB相关验证器
export {
  TMDBValidators,
  TMDBParamValidators,
  TMDBQueryValidators
} from './tmdb.validator';

// 仪表板相关验证器
export {
  DashboardValidators,
  DashboardQueryValidators,
} from './dashboard.validator';

// 系统相关验证器
export {
  SystemValidator
} from './system.validator';

// 验证中间件
export {
  validateRequest,
  validateMultiple,
  ValidationMiddleware,
  ValidatorComposer,
  type ValidationConfig,
  type ValidationType
} from '../middleware/validation.middleware';
