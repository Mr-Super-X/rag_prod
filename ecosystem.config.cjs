module.exports = {
  apps: [{
    name: "rag-api",
    script: "./dist/server.js",
    instances: 2,
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production",
    },
    error_file: "./logs/err.log",
    out_file: "./logs/out.log",
    merge_logs: true,
  }],
};
