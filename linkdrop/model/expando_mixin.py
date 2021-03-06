# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Raindrop.
#
# The Initial Developer of the Original Code is
# Mozilla Messaging, Inc..
# Portions created by the Initial Developer are Copyright (C) 2009
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#

# A mixin for all objects which want 'expando' functionality;
# ie, the ability to have arbitrary content stored in a json column, but
# have the object seamlessly provide access to the items in the json as though
# they were real properties.

import json
import copy
from sqlalchemy.orm.interfaces import MapperExtension, EXT_CONTINUE
from sqlalchemy import Column, Text
from sqlalchemy import types

class Json(types.TypeDecorator, types.MutableType):
    impl=types.Text

    def process_bind_param(self, value, dialect):
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        return value and json.loads(value) or {}

    def copy_value(self, value):
        return copy.copy(value)

    def is_mutable(self):
        return True

# The actual mixin class
class JsonExpandoMixin(object):
    json_attributes = Column(Json())

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        # is it in the namespace?
        try:
            return self.json_attributes[name]
        except KeyError:
            raise AttributeError(name)

    def __setattr__(self, name, value):
        if name.startswith("_") or name in self.__dict__ or hasattr(self.__class__, name):
            object.__setattr__(self, name, value)
            return
        # assume it is an 'expando' object
        # Set json attributes to itself simply so the object is marked as
        # 'dirty' for subsequent updates.
        self.json_attributes = self.json_attributes or {}
        self.json_attributes[name] = value

    def __delattr__(self, name):
        try:
            del self.json_attributes[name]
            self.json_attributes = self.json_attributes # to mark as dirty
        except KeyError:
            raise AttributeError("'%s' is not an 'expando' property" % (name,))
