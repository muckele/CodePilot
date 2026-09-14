const developmentMongoUri =
  "mongodb://127.0.0.1:27018/codelift?replicaSet=rs0&directConnection=true";

export function buildAccountOperatorEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const operatorEnvironment: NodeJS.ProcessEnv = {
    ...environment,
    REGISTRATION_MODE: environment.REGISTRATION_MODE ?? "closed",
    PERSISTENCE_MODE: "required"
  };

  if (environment.MONGO_URI === undefined && environment.MONGO_URI_FILE === undefined) {
    operatorEnvironment.MONGO_URI = developmentMongoUri;
  }

  return operatorEnvironment;
}
