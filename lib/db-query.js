const { Client } = require("pg");

const logQuery = (statement, parameters) => {
  let timeStamp = new Date();
  let formattedTimeStamp = timeStamp.toString().substring(4, 24);
  console.log(formattedTimeStamp, statement, parameters);
}

module.exports = {
  async dbQuery(statement, ...parameters) {
    let client = new Client({       
      host: "/var/run/postgresql",
      port: 5432,
      user: "ec2-user",
      database: "todo-lists",
    });

    await client.connect();
    logQuery(statement, parameters);
    let result = await client.query(statement, parameters);
    await client.end();

    return result;
  }
};