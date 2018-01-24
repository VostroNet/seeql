"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createBeforeAfter;

var _getModelDef = _interopRequireDefault(require("../utils/get-model-def"));

var _events = _interopRequireDefault(require("../events"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function createBeforeAfter(model, options, hooks = {}) {
  let targetBeforeFuncs = [],
      targetAfterFuncs = [];

  if (hooks.after) {
    targetAfterFuncs = targetAfterFuncs.concat(hooks.after);
  }

  const modelDefinition = (0, _getModelDef.default)(model);

  if (options.before) {
    targetBeforeFuncs.push(function (params, args, context, info) {
      return options.before({
        params,
        args,
        context,
        info,
        modelDefinition,
        type: _events.default.QUERY
      });
    });
  }

  if (options.after) {
    targetAfterFuncs.push(function (result, args, context, info) {
      return options.after({
        result,
        args,
        context,
        info,
        modelDefinition,
        type: _events.default.QUERY
      });
    });
  }

  if (modelDefinition.before) {
    targetBeforeFuncs.push(function (params, args, context, info) {
      return modelDefinition.before({
        params,
        args,
        context,
        info,
        modelDefinition,
        type: _events.default.QUERY
      });
    });
  }

  if (modelDefinition.after) {
    targetAfterFuncs.push(function (result, args, context, info) {
      return modelDefinition.after({
        result,
        args,
        context,
        info,
        modelDefinition: modelDefinition,
        type: _events.default.QUERY
      });
    });
  }

  if (hooks.before) {
    targetBeforeFuncs = targetBeforeFuncs.concat(hooks.before);
  }

  const targetBefore = (findOptions, args, context, info) => {
    // console.log("weee", {context, rootValue: info.rootValue})
    findOptions.context = context;
    findOptions.rootValue = info.rootValue;

    if (targetBeforeFuncs.length === 0) {
      return findOptions;
    }

    const results = targetBeforeFuncs.reduce((prev, curr) => {
      return curr(prev, args, context, info);
    }, findOptions);
    return results;
  };

  const targetAfter = (result, args, context, info) => {
    if (targetAfterFuncs.length === 0) {
      return result;
    }

    return targetAfterFuncs.reduce((prev, curr) => {
      return curr(prev, args, context, info);
    }, result);
  };

  const targetAfterArray = (results, args, context, info) => {
    if (targetAfterFuncs.length === 0) {
      return results;
    }

    return results.map(result => {
      return targetAfter(result, args, context, info);
    });
  };

  return {
    before: targetBefore,
    after: targetAfter,
    afterList: targetAfterArray
  };
}
//# sourceMappingURL=create-before-after.js.map