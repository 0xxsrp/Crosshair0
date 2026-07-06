const fs =
require("fs");

function importProfile(
path
){

    return JSON.parse(

        fs.readFileSync(
        path,
        "utf8"
        )

    );

}

module.exports =
{
 importProfile
};