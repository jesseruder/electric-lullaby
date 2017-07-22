import React from 'react';
import {
  AsyncStorage,
  ActivityIndicator,
  Button,
  Clipboard,
  Image,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from 'react-native';

import Expo, {
  Permissions,
  Constants,
  ImagePicker,
  Notifications,
} from 'expo';

import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

//const API_HOST = 'http://b1634808.ngrok.io';
const API_HOST = 'https://electric-lullaby.herokuapp.com';
const DURATION = 5000;

export default class App extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      loading: true,
      authed: false,
      uploading: false,
      authError: null,
      imageUrls: [],

      inputUsername: '',
      inputPassword: '',
      inputFollow: '',
    };

    this._interval = null;
  }

  _follow = async () => {
    let response = await this._apiRequestAsync({
      token: this.state.token,
      userToFollow: this.state.inputFollow,
    }, 'follow', 'POST');

    this.setState({
      inputFollow: '',
    });
  }

  _handleNotification = () => {
    this.getImagesAsync();
  }

  onAuthed = () => {
    this.registerForPushNotificationsAsync();
    this.getImagesAsync();
  }

  registerForPushNotificationsAsync = async () => {
    if (!this.state.token) {
      return;
    }

    const { existingStatus } = await Permissions.getAsync(Permissions.NOTIFICATIONS);
    let finalStatus = existingStatus;

    // only ask if permissions have not already been determined, because
    // iOS won't necessarily prompt the user a second time.
    if (existingStatus !== 'granted') {
      // Android remote notification permissions are granted during the app
      // install, so this will only ask on iOS
      const { status } = await Permissions.askAsync(Permissions.NOTIFICATIONS);
      finalStatus = status;
    }

    // Stop here if the user did not grant permissions
    if (finalStatus !== 'granted') {
      return;
    }

    // Get the token that uniquely identifies this device
    let pushToken = await Notifications.getExpoPushTokenAsync();
    let response = await this._apiRequestAsync({
      token: this.state.token,
      pushToken,
    }, 'pushToken', 'POST');
  };

  getImagesAsync = async () => {
    if (!this.state.token) {
      return [];
    }

    let response = await this._apiRequestAsync({
      token: this.state.token,
    }, 'imageUrls', 'POST');
    console.log('imageurls ' + JSON.stringify(response));

    if (response.urls && response.urls.length) {
      this.setState(state => {
        if (state.imageUrls.length === 0) {
          if (this._interval) {
            clearInterval(this._interval);
          }

          this._interval = setInterval(this._removeImage, DURATION);
        }

        return {
          imageUrls: state.imageUrls.concat(response.urls),
        };
      });
    }
  };

  _removeImage = () => {
    this.setState(state => {
      if (state.imageUrls && state.imageUrls.length) {
        state.imageUrls.shift();
      }
      return {
        imageUrls: state.imageUrls,
      }
    })
  }

  async componentWillMount() {
    const token = await AsyncStorage.getItem('token');
    const username = await AsyncStorage.getItem('username');
    this.setState({
      loading: false,
      authed: !!token,
      token,
      username,
    });

    this.registerForPushNotificationsAsync();
    this.getImagesAsync();
    Notifications.addListener(this._handleNotification);
  }

  render() {
    let { loading, authed, authError, username, imageUrls } = this.state;
    let hasImage = imageUrls && imageUrls.length;

    if (loading) {
      return (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        </View>
      );
    }

    if (authed) {
      return (
        <View style={{flex: 1, alignItems: 'center', backgroundColor: '#FFFF00'}}>
          <StatusBar barStyle="default" />
          <View style={{backgroundColor: '#ffffff', width: '100%', height: 50, alignItems: 'center', justifyContent: 'center'}}>
            <Text style={{color: '#ff598f', fontWeight: '700', fontSize: 18}}>Hi {username}</Text>
          </View>
          <TouchableOpacity onPress={this._logoutAsync} style={{position: 'absolute', top: 0, right: 0, backgroundColor: '#ff598f', width: 100, height: 50, alignItems: 'center', justifyContent: 'center'}}>
            <Text style={styles.button}>LOG OUT</Text>
          </TouchableOpacity>

          <View style={{flex: 1, flexDirection: 'row', height: 50}}>
            <TextInput
              underlineColorAndroid="#00bfaf"
              placeholder="follow someone!"
              placeholderTextColor="#222222"
              style={{height: 50, width: '50%', backgroundColor: '#00bfaf', paddingLeft: 20, fontWeight: '700', fontSize: 16}}
              onChangeText={(inputFollow) => this.setState({inputFollow})}
              value={this.state.inputFollow}
            />
            <TouchableOpacity onPress={this._follow} style={{backgroundColor: '#ff598f', width: '30%', height: 50, alignItems: 'center', justifyContent: 'center'}}>
              <Text style={styles.button}>FOLLOW</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={this.getImagesAsync} style={{backgroundColor: '#ffffff', width: '20%', height: 50, alignItems: 'center', justifyContent: 'center'}}>
              <MaterialCommunityIcons name="reload" size={32} color="#ff598f" />
            </TouchableOpacity>
          </View>

          <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 100, bottom: 0, left: 0, right: 0}}>
            {!hasImage &&
              <TouchableOpacity onPress={this._takePhoto}>
                <Ionicons name="md-camera" size={200} color="#01dddd" />
              </TouchableOpacity>
            }
            { this._maybeRenderImage() }
          </View>



          { this._maybeRenderUploadingOverlay() }
        </View>
      );
    } else {
      return (
        <View style={{flex: 1, alignItems: 'center', paddingTop: '25%', backgroundColor: '#FFFF00'}}>
          <TextInput
            underlineColorAndroid="#fd8a5e"
            placeholder="USERNAME"
            placeholderTextColor="#888888"
            style={{height: 60, width: '100%', backgroundColor: '#fd8a5e', paddingLeft: 40, fontWeight: '800', fontSize: 20}}
            onChangeText={(inputUsername) => this.setState({inputUsername})}
            value={this.state.inputUsername}
          />
          <TextInput
            secureTextEntry
            placeholder="PASSWORD"
            placeholderTextColor="#888888"
            underlineColorAndroid="#01dddd"
            style={{height: 60, width: '100%', backgroundColor: '#01dddd', paddingLeft: 40, fontWeight: '800', fontSize: 20}}
            onChangeText={(inputPassword) => this.setState({inputPassword})}
            value={this.state.inputPassword}
          />

          <View style={{flex: 1, flexDirection: 'row'}}>
            <TouchableOpacity onPress={this._loginAsync} style={styles.buttonContainer}>
              <Text style={styles.button}>LOGIN</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={this._signupAsync} style={styles.buttonContainer}>
              <Text style={styles.button}>SIGN UP</Text>
            </TouchableOpacity>
          </View>

          {authError && <Text style={{paddingTop: 40, fontWeight: '800', fontSize: 20}}>{authError}</Text>}
        </View>
      );
    }
  }

  _apiRequestAsync = async (payload, endpoint, method) => {
    try {
      let options = {
        method: method,
        body: JSON.stringify(payload),
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json'
        },
      };

      let result = await fetch(API_HOST + '/' + endpoint, options);
      return await result.json();
    } catch (e) {
      return {};
    }
  }

  _loginAsync = async () => {
    let username = this.state.inputUsername;
    let password = this.state.inputPassword;

    let response = await this._apiRequestAsync({
      username,
      password,
    }, 'login', 'POST');

    let token = response.token;

    if (token) {
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('username', username);

      this.setState({
        authed: true,
        token,
        username,
        authError: null,
      }, this.onAuthed);
    } else {
      this.setState({
        authError: `Couldn't log in!`,
      });
    }
  }

  _signupAsync = async () => {
    let username = this.state.inputUsername;
    let password = this.state.inputPassword;

    let response = await this._apiRequestAsync({
      username,
      password,
    }, 'signup', 'POST');

    let token = response.token;
    console.log('got token: ' + token)

    if (token) {
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('username', username);

      this.setState({
        authed: true,
        token,
        username,
        authError: null,
      }, this.onAuthed);
    } else {
      this.setState({
        authError: `Couldn't create account!`,
      });
    }
  }

  _sendImageAsync = async (url) => {
    let response = await this._apiRequestAsync({
      token: this.state.token,
      url,
    }, 'sendImage', 'POST');
  };

  _logoutAsync = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('username');

    this.setState({
      authed: false,
      token: null,
      username: null,
    });
  }

  _maybeRenderUploadingOverlay = () => {
    if (this.state.uploading) {
      return (
        <View style={[StyleSheet.absoluteFill, {backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center'}]}>
          <ActivityIndicator
            color="#fff"
            animating
            size="large"
          />
        </View>
      );
    }
  }

  _maybeRenderImage = () => {
    let { imageUrls } = this.state;
    if (!imageUrls || !imageUrls.length) {
      return;
    }

    return (
      <View style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, right: 0
      }}>
        <TouchableOpacity onPress={this._removeImage}>
          <View style={{borderTopRightRadius: 3, borderTopLeftRadius: 3, overflow: 'hidden'}}>
            <Image
              source={{uri: imageUrls[0]}}
              style={{width: '100%', height: '100%'}}
              resizeMode="cover"
            />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  _takePhoto = async () => {
    let pickerResult = await ImagePicker.launchCameraAsync({
      quality: 0.5,
    });

    this._handleImagePicked(pickerResult);
  }

  _handleImagePicked = async (pickerResult) => {
    let uploadResponse, uploadResult;

    try {
      this.setState({uploading: true});

      if (!pickerResult.cancelled) {
        uploadResponse = await uploadImageAsync(pickerResult.uri);
        uploadResult = await uploadResponse.json();

        this._sendImageAsync(uploadResult.location);
      }
    } catch(e) {
      console.log({uploadResponse});
      console.log({uploadResult});
      console.log({e});
      alert('Upload failed, sorry :(');
    } finally {
      this.setState({uploading: false});
    }
  }
}

async function uploadImageAsync(uri) {
  let apiUrl = `${API_HOST}/upload`;

  let uriParts = uri.split('.');
  let fileType = uri[uri.length - 1];

  let formData = new FormData();
  formData.append('photo', {
    uri,
    name: `photo.${fileType}`,
    type: `image/${fileType}`,
  });

  let options = {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'multipart/form-data',
    },
  };

  return fetch(apiUrl, options);
}

const styles = StyleSheet.create({
  buttonContainer: {margin: 10, backgroundColor: '#ff598f', width: 80, height: 50, alignItems: 'center', justifyContent: 'center'},
  button: {color: '#ffffff', fontWeight: '700', fontSize: 18},
});
