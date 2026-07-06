const fs =
require("fs");

function exportProfile(
path,
data
){

    fs.writeFileSync(
    path,
    JSON.stringify(
    data,
    null,
    2
    )
    );

}

module.exports =
{
 exportProfile
};