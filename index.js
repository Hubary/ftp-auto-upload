const Client = require('ssh2-sftp-client');
const sftp = new Client();
const helper = require('./helper');

const chalk = require('chalk');

const path = require('path');
const fs = require('fs');
const ora = require('ora');
const { type } = require('os');
let config = [];
const configFileName = 'ftp.config.js';
const ftpConfig = path.resolve(process.cwd(), configFileName);
if (ftpConfig && fs.existsSync(ftpConfig)) {
  config = require(ftpConfig);
}

let rootDir = 'dist';

/**
 * 进行ftp配置检测
 * @param Object {*} localPath  romotePath
 */
function safeCheck({ localPath, romotePath }) {
  if (!romotePath || !localPath) {
    console.log(chalk.yellow(`请配置${configFileName}的romotePath/localPath`));
    process.exit();
  }
  try {
    var ex = fs.statSync(path.resolve(process.cwd(), localPath));
    if (!ex.isDirectory()) {
      console.log(chalk`
检测到localPath: {green ${localPath}}目录不存在
  `);
      process.exit();
    }
  } catch (error) {
    console.log(chalk`
检测到localPath: {green ${localPath}}目录不存在
`);
    process.exit();
  }
  var reg = new RegExp(`${rootDir}$`);
  if (!reg.test(romotePath)) {
    console.log(chalk`
检测到romotePath路径末尾不是{green ${rootDir}},请检查${configFileName}文件的romotePath
`);
    console.log(chalk.yellow(''));
    process.exit();
  }
  console.log(chalk`
· {green ${'localPath/romotePath check pass'}}
`);
}

async function main() {
  if (!Array.isArray(config) || config.length === 0) {
    console.log(chalk`
· 请在项目根目录下新建{yellow ${configFileName}},并进行相应配置,具体参考node_modules下@hubary/ftp-auto-upload/${configFileName}
`);
    process.exit();
  }
  const SELECT_CONFIG = (await helper(config)).value; // 所选部署项目的配置信息
  const { isTest, name, ssh, romotePath, localPath } = SELECT_CONFIG;

  // console.log('SELECT_CONFIG', SELECT_CONFIG)
  if (SELECT_CONFIG.rootDir) {
    rootDir = SELECT_CONFIG.rootDir;
  }
  console.log(chalk`
· 已选择部署 {yellow ${name}}`);
  // 进行文件路径安全检测
  safeCheck(SELECT_CONFIG);
  console.log(chalk`
· 1/5 Connecting {blue ${name}}
`);
  const spinner = ora(chalk`  loading, please wait a moment.....

`);
  sftp
    .connect(ssh)
    .then((data) => {
      console.log(chalk`
· 2/5 {green Success connect}   ====> ready check {blue ${romotePath}}`);
      return sftp.exists(romotePath);
    })
    .then((data) => {
      console.log(chalk`  from server message:  {yellow sftp.exists: ${data}}`);
      if (isTest) {
        console.log(chalk.yellow('· 3/5  I am test mode!'));
        return data;
      } else if (data === false) {
        console.log(chalk`
· 3/5 ${romotePath} non-existent`);
        return data;
      } else if (data === 'd') {
        console.log(chalk`
· 3/5 {red Ready rmdir -rf} {blue ${romotePath}}`);
        spinner.start();
        return sftp.rmdir(romotePath, true);
      }
    })
    .then((data) => {
      spinner.stop();
      console.log(chalk`  from server message:  {yellow ${data}}`);
      console.log(chalk`
· 4/5 Uploading: {blue ${localPath}} ====>  {blue ${romotePath}}`);
      if (isTest) {
        console.log(chalk.yellow('  I am test mode!'));
      } else {
        spinner.start();
        return sftp.uploadDir(localPath, romotePath);
      }
    })
    .then((data) => {
      spinner.stop();
      console.log(chalk`  from server message:  {yellow ${data}}`);
      console.log(chalk`
· 5/5 {green Upload succeeded }

   npm: https://www.npmjs.com/package/@hubary/ftp-auto-upload
github: https://github.com/hubary/ftp-auto-upload

`);
    })
    .catch((err) => {
      spinner.stop();
      console.log(err);
      console.log(
        chalk.yellow(`
========= 噢哟，尴尬，出错了 !=========
`)
      );
    })
    .finally(() => {
      sftp.end(); // 断开连接
    });
}

main();
