"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = connect;

var _sequelize = require("sequelize");

var _sequelize2 = _interopRequireDefault(_sequelize);

var _logger = require("./utils/logger");

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const log = (0, _logger2.default)("seeql::database:");

function connect(schemas, instance, options) {
  loadSchemas(schemas, instance);
  return instance;
}

function loadSchemas(schemas, instance, options = {}) {
  const { defaultAttr, defaultModel } = options;
  schemas.forEach(schema => {
    instance.define(schema.name, Object.assign({}, defaultAttr, schema.define), Object.assign({}, defaultModel, schema.options));
    instance.models[schema.name].$gqlsql = schema;
    if (/^4/.test(_sequelize2.default.version)) {
      let { classMethods, instanceMethods } = schema;
      if (schema.options) {
        if (schema.options.classMethods) {
          classMethods = schema.options.classMethods;
        }
        if (schema.options.instanceMethods) {
          instanceMethods = schema.options.instanceMethods;
        }
      }
      if (classMethods) {
        Object.keys(classMethods).forEach(classMethod => {
          instance.models[schema.name][classMethod] = classMethods[classMethod];
        });
      }
      if (instanceMethods) {
        Object.keys(instanceMethods).forEach(instanceMethod => {
          instance.models[schema.name].prototype[instanceMethod] = instanceMethods[instanceMethod];
        });
      }
    }
  });
  schemas.forEach(schema => {
    (schema.relationships || []).forEach(relationship => {
      createRelationship(instance, schema.name, relationship.model, relationship.name, relationship.type, Object.assign({ as: relationship.name }, relationship.options));
    });
  });
}

function createRelationship(instance, targetModel, sourceModel, name, type, options = {}) {
  let model = instance.models[targetModel];
  if (!model.relationships) {
    model.relationships = {};
  }
  try {
    model.relationships[name] = {
      type: type,
      source: sourceModel,
      target: targetModel,
      rel: model[type](instance.models[sourceModel], options)
    };
  } catch (err) {
    log.error("Error Mapping relationship", { model, sourceModel, name, type, options, err });
  }
  instance.models[targetModel] = model;
}
//# sourceMappingURL=database.js.map