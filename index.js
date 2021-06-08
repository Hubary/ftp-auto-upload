const Client = require('ssh2-sftp-client')
const sftp = new Client()
const helper = require('./helper')

const chalk = require('chalk')

const path = require('path');
const fs = require("fs");
const ora = require('ora')
let config = [];
const configFileName = 'ftp.config.js'
const ftpConfig = path.resolve(process.cwd(), configFileName)
if (ftpConfig && fs.existsSync(ftpConfig)) {
  config = require(ftpConfig)
}

let rootDir = 'dist';


/**
 * 进行ftp配置检测
 * @param Object {*} localPath  romotePath
 */
function safeCheck({ localPath, romotePath }) {
  if (!romotePath || !localPath) {
    console.log(chalk.yellow(`请配置${configFileName}的romotePath/localPath`))
    process.exit();
  }
  try {
    var ex = fs.statSync(path.resolve(process.cwd(), localPath));
    if (!ex.isDirectory()) {
      console.log(chalk`
检测到localPath: {green ${localPath}}目录不存在
  `)
      process.exit();
    }
  } catch (error) {
    console.log(chalk`
检测到localPath: {green ${localPath}}目录不存在
`)
    process.exit();
  }
  var reg = new RegExp(`${rootDir}$`);
  if (!reg.test(romotePath)) {
    console.log(chalk`
检测到romotePath路径末尾不是{green ${rootDir}},请检查${configFileName}文件的romotePath
`)
    console.log(chalk.yellow(''))
    process.exit();
  }
  console.log(chalk`
· {green ${'localPath/romotePath 检测通过'}}
`)
}


async function main() {
  if (!Array.isArray(config) || config.length === 0) {
    console.log(chalk`
· 请在项目根目录下新建{yellow ${configFileName}},并进行相应配置,具体参考node_modules下@hubary/ftp-auto-upload/${configFileName}
`)
    process.exit();
  }
  const SELECT_CONFIG = (await helper(config)).value // 所选部署项目的配置信息
  const { isTest, name, ssh, romotePath, localPath } = SELECT_CONFIG;

  // console.log('SELECT_CONFIG', SELECT_CONFIG)
  if (SELECT_CONFIG.rootDir) {
    rootDir = SELECT_CONFIG.rootDir
  }
  console.log(chalk`
· 已选择部署 {yellow ${name}}
`)
  // 进行文件路径安全检测
  safeCheck(SELECT_CONFIG);
  console.log(chalk`
· 1/5 正在连接 {blue ${name}}
`)
  const spinner = ora('操作中...')
  sftp
    .connect(ssh)
    .then((data) => {
      console.log(chalk`
· 2/5 {green ${'连接成功'}}
`)
      console.log(chalk`
· 3/5 即将 rmdir -rf {blue ${romotePath}}`)
      if (isTest) {
        console.log(chalk.yellow('  我是测试模式'))
      } else {
        spinner.start()
        return sftp.rmdir(romotePath, true)
      }
    })
    .then((data) => {
      spinner.stop()
      console.log(data);
      console.log(chalk`
· 4/5 正在上传: {blue ${localPath}} ====>  {blue ${romotePath}}`);
      if (isTest) {
        console.log(chalk.yellow('  我是测试模式'))
      } else {
        spinner.start()
        return sftp.uploadDir(localPath, romotePath)
      }
    })
    .then(data => {
      spinner.stop()
      console.log(data);
      console.log(chalk`
· 5/5 {green ${'更新成功!'}}
`)

    })
    .catch(err => {
      spinner.stop()
      console.log(err);
      console.log(chalk.yellow(`
========= 啊，出错了 !=========
`))
    })
    .finally(() => {
      sftp.end()// 断开连接
    })
}

main()

