import EventEmitter from 'events'
import mixin from 'mixin'
import { values } from 'lodash'

import Mixins from './mixins'

@mixin(values(Mixins))
export default class App extends EventEmitter {}
