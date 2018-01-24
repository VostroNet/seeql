"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createModelTypes;

var _graphql = require("graphql");

var _graphqlSequelize = require("graphql-sequelize");

var _getModelDef = _interopRequireDefault(require("../utils/get-model-def"));

var _createBeforeAfter = _interopRequireDefault(require("./create-before-after"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

async function createModelTypes(models, keys, prefix = "", options) {
  const result = await keys.reduce((promise, modelName) => {
    return promise.then(async o => {
      o[modelName] = await createModelType(modelName, models, prefix, options);
      return o;
    });
  }, Promise.resolve({}));
  return result;
}

async function createModelType(modelName, models, prefix = "", options = {}) {
  if (options.permission) {
    if (options.permission.model) {
      const result = await options.permission.model(modelName);

      if (!result) {
        // console.log("exluding", modelName);
        return undefined;
      }
    }
  }

  const model = models[modelName];
  const modelDefinition = (0, _getModelDef.default)(model);
  let exclude = Object.keys(modelDefinition.override || {}).concat(modelDefinition.ignoreFields || []);

  if (options.permission) {
    if (options.permission.field) {
      exclude = exclude.concat(Object.keys(model.rawAttributes).filter(keyName => !options.permission.field(modelName, keyName)));
    }
  }

  let fields = (0, _graphqlSequelize.attributeFields)(model, {
    exclude
  });

  if (modelDefinition.override) {
    Object.keys(modelDefinition.override).forEach(fieldName => {
      if (options.permission) {
        if (options.permission.field) {
          if (!options.permission.field(modelName, fieldName)) {
            return;
          }
        }
      }

      const fieldDefinition = modelDefinition.define[fieldName];
      const overrideFieldDefinition = modelDefinition.override[fieldName];
      let type;

      if (!(overrideFieldDefinition.type instanceof _graphql.GraphQLObjectType) && !(overrideFieldDefinition.type instanceof _graphql.GraphQLScalarType) && !(overrideFieldDefinition.type instanceof _graphql.GraphQLEnumType)) {
        type = new _graphql.GraphQLObjectType(overrideFieldDefinition.type);
      } else {
        type = overrideFieldDefinition.type;
      }

      if (!fieldDefinition.allowNull) {
        type = new _graphql.GraphQLNonNull(type);
      }

      fields[fieldName] = {
        type,
        resolve: overrideFieldDefinition.output
      };
    });
  }

  let resolve;

  if (modelDefinition.resolver) {
    resolve = modelDefinition.resolver;
  } else {
    const {
      before,
      after
    } = (0, _createBeforeAfter.default)(model, options);
    resolve = (0, _graphqlSequelize.resolver)(model, {
      before,
      after
    });
  }

  return new _graphql.GraphQLObjectType({
    name: `${prefix}${modelName}`,
    description: "",
    fields: fields,
    resolve: resolve
  });
}
//# sourceMappingURL=create-base.js.map