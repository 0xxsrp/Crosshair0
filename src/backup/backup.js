const fs =
require("fs");

const path =
require("path");

function backup(
settings
){

 const file =
 path.join(
 __dirname,
 "backups.json"
 );

 const backups =
 JSON.parse(
 fs.readFileSync(
 file
 )
 );

 backups.push({

  date:
  new Date(),

  settings

 });

 fs.writeFileSync(

 file,

 JSON.stringify(
 backups,
 null,
 2
 )

 );

}