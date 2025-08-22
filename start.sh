#!/bin/sh

# 定义用户配置目录和示例配置目录的路径
CONFIG_DIR="/app/config"
EXAMPLE_DIR="/app/config.example"

# 检查并复制示例配置
if [ -d "$CONFIG_DIR" ] && [ -z "$(ls -A $CONFIG_DIR)" ]; then
    echo "初始化配置文件..."
    cp $EXAMPLE_DIR/config.json.example $CONFIG_DIR/config.json
    cp $EXAMPLE_DIR/prompt.md $CONFIG_DIR/prompt.md
    cp $EXAMPLE_DIR/regexConfig.js $CONFIG_DIR/regexConfig.js
    echo "配置文件已复制，请编辑 $CONFIG_DIR/config.json"
fi

# 定义初始数据库和最终数据库的路径
INITIAL_DB_PATH="/app/db_init/dev.db"
FINAL_DB_PATH="/app/data/dev.db"

# 检查最终的数据卷中是否已存在数据库文件
# 如果不存在，并且镜像中存在预生成的文件，则复制过去
if [ ! -f "$FINAL_DB_PATH" ] && [ -f "$INITIAL_DB_PATH" ]; then
    echo "数据库在卷中找不到。复制初始数据库..."
    cp $INITIAL_DB_PATH $FINAL_DB_PATH
    echo "初始数据库复制成功"

# 如果 /file/monitor 和 /file/target 不存在则创建
if [ ! -d "/file/monitor" ]; then
    echo "目录 /file/monitor 不存在，创建中..."
    mkdir -p "/file/monitor"
fi

if [ ! -d "/file/target" ]; then
    echo "目录 /file/target 不存在，创建中..."
    mkdir -p "/file/target"
fi

fi

# 启动nginx (后台)
echo "启动nginx..."
nginx

exec "$@"
