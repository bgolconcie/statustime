// Entry point: check the Node.js version before loading the server, which needs the built-in node:sqlite
const MIN = [22, 13]
const [major, minor] = process.versions.node.split('.').map(Number)

if (major < MIN[0] || (major === MIN[0] && minor < MIN[1])) {
  console.error(`
  SellFree needs Node.js ${MIN.join('.')} or newer — this computer has ${process.versions.node}.
  Install the current LTS version from https://nodejs.org, then run "npm install" and "npm run dev" again.

  SellFree צריכה Node.js ${MIN.join('.')} ומעלה — במחשב הזה מותקנת גרסה ${process.versions.node}.
  התקינו את גרסת ה-LTS העדכנית מ-https://nodejs.org, ואז הריצו שוב "npm install" ו-"npm run dev".
`)
  process.exit(1)
}

await import('./index.js')
