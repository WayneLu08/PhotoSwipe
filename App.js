import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  Dimensions,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  StatusBar,
  SafeAreaView
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import {
  PanGestureHandler,
  GestureHandlerRootView,
  State
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);

  // 动画 Shared Values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      if (status === 'granted') {
        loadPhotos();
        loadAlbums();
      }
    })();
  }, []);

  // 加载手机相册照片
  const loadPhotos = async () => {
    const assets = await MediaLibrary.getAssetsAsync({
      first: 100,
      mediaType: 'photo',
      sortBy: [MediaLibrary.SortBy.creationTime]
    });
    setPhotos(assets.assets);
  };

  // 加载手机相册列表
  const loadAlbums = async () => {
    const userAlbums = await MediaLibrary.getAlbumsAsync();
    setAlbums(userAlbums);
  };

  // 触发触觉反馈
  const triggerHaptic = (type) => {
    if (type === 'delete') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  // 执行动作
  const handleAction = async (action, targetAlbum = null) => {
    if (currentIndex >= photos.length) return;
    const currentPhoto = photos[currentIndex];

    // 记录历史供撤销
    setHistory(prev => [...prev, { photo: currentPhoto, action, album: targetAlbum, index: currentIndex }]);

    if (action === 'delete') {
      triggerHaptic('delete');
      // 真实删除：放入系统废纸篓或从应用中移除
      // await MediaLibrary.deleteAssetsAsync([currentPhoto]);
    } else if (action === 'like') {
      triggerHaptic('success');
      // 标记收藏或添加进"喜欢"相册
    } else if (action === 'album' && targetAlbum) {
      triggerHaptic('success');
      try {
        await MediaLibrary.addAssetsToAlbumAsync([currentPhoto], targetAlbum, false);
      } catch (e) {
        console.log('添加相册失败:', e);
      }
    } else if (action === 'keep') {
      triggerHaptic('light');
    }

    // 重置位移并移到下一张
    translateX.value = 0;
    translateY.value = 0;
    setCurrentIndex(prev => prev + 1);
  };

  // 撤销上一步
  const handleUndo = () => {
    if (history.length === 0 || currentIndex === 0) {
      Alert.alert('提示', '当前没有可撤销的操作');
      return;
    }
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(prev => prev - 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // 手势结束判断方向
  const onGestureEnd = (dx, dy) => {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absY > absX && absY > SWIPE_THRESHOLD) {
      if (dy < -SWIPE_THRESHOLD) {
        // ⬆ 上滑：喜欢
        translateY.value = withTiming(-SCREEN_HEIGHT, {}, () => {
          runOnJS(handleAction)('like');
        });
      } else {
        // ⬇ 下滑：收纳到相册
        setPendingPhoto(photos[currentIndex]);
        setModalVisible(true);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    } else if (absX > SWIPE_THRESHOLD) {
      if (dx < -SWIPE_THRESHOLD) {
        // ⬅ 左滑：删除
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, {}, () => {
          runOnJS(handleAction)('delete');
        });
      } else {
        // ➡ 右滑：保留
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, {}, () => {
          runOnJS(handleAction)('keep');
        });
      }
    } else {
      // 弹簧复位
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    }
  };

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = `${(translateX.value / SCREEN_WIDTH) * 20}deg`;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: rotate }
      ]
    };
  });

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionText}>需要相册访问权限才能整理照片 🐱</Text>
      </View>
    );
  }

  const currentPhoto = photos[currentIndex];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* 顶部标题与进度 */}
        <View style={styles.header}>
          <Text style={styles.title}>📸 PhotoSwipe</Text>
          <Text style={styles.counter}>
            {photos.length > 0 ? `${currentIndex + 1} / ${photos.length}` : '加载中...'}
          </Text>
        </View>

        {/* 卡片区域 */}
        <View style={styles.deck}>
          {currentIndex < photos.length && currentPhoto ? (
            <PanGestureHandler
              onGestureEvent={(e) => {
                translateX.value = e.nativeEvent.translationX;
                translateY.value = e.nativeEvent.translationY;
              }}
              onHandlerStateChange={(e) => {
                if (e.nativeEvent.state === State.END) {
                  onGestureEnd(e.nativeEvent.translationX, e.nativeEvent.translationY);
                }
              }}
            >
              <Animated.View style={[styles.card, animatedCardStyle]}>
                <Image source={{ uri: currentPhoto.uri }} style={styles.photo} resizeMode="cover" />
                <View style={styles.photoInfo}>
                  <Text style={styles.photoName} numberOfLines={1}>{currentPhoto.filename}</Text>
                  <Text style={styles.photoDate}>
                    {new Date(currentPhoto.creationTime).toLocaleDateString()}
                  </Text>
                </View>
              </Animated.View>
            </PanGestureHandler>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 50 }}>🎉</Text>
              <Text style={styles.emptyTitle}>全部整理完毕！</Text>
              <Text style={styles.emptySubtitle}>你已成功整理了当前批次照片</Text>
            </View>
          )}
        </View>

        {/* 底部按钮栏 */}
        <View style={styles.controls}>
          <TouchableOpacity style={[styles.btn, styles.undoBtn]} onPress={handleUndo}>
            <Text style={styles.btnText}>↩ 撤销</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.deleteBtn]}
            onPress={() => handleAction('delete')}
          >
            <Text style={styles.btnText}>🗑 左滑删</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.albumBtn]}
            onPress={() => {
              setPendingPhoto(photos[currentIndex]);
              setModalVisible(true);
            }}
          >
            <Text style={styles.btnText}>📁 下滑收</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.likeBtn]}
            onPress={() => handleAction('like')}
          >
            <Text style={styles.btnText}>❤️ 上滑爱</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.keepBtn]}
            onPress={() => handleAction('keep')}
          >
            <Text style={styles.btnText}>✅ 右滑留</Text>
          </TouchableOpacity>
        </View>

        {/* 相册选择弹窗 */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>选择归档相册</Text>
              <FlatList
                data={albums}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.albumItem}
                    onPress={() => {
                      setModalVisible(false);
                      handleAction('album', item);
                    }}
                  >
                    <Text style={styles.albumTitle}>📁 {item.title}</Text>
                    <Text style={styles.albumCount}>{item.assetCount} 张</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center'
  },
  permissionText: {
    color: '#94a3b8',
    fontSize: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center'
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#38bdf8'
  },
  counter: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500'
  },
  deck: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16
  },
  card: {
    width: SCREEN_WIDTH - 36,
    height: SCREEN_HEIGHT * 0.65,
    backgroundColor: '#1e293b',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  photo: {
    flex: 1,
    width: '100%'
  },
  photoInfo: {
    padding: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.9)'
  },
  photoName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600'
  },
  photoDate: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12
  },
  emptySubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 6
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center'
  },
  undoBtn: { backgroundColor: '#334155' },
  deleteBtn: { backgroundColor: '#7f1d1d' },
  albumBtn: { backgroundColor: '#1e3a8a' },
  likeBtn: { backgroundColor: '#064e3b' },
  keepBtn: { backgroundColor: '#4c1d95' },
  btnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '60%'
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16
  },
  albumItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)'
  },
  albumTitle: {
    color: '#f8fafc',
    fontSize: 15
  },
  albumCount: {
    color: '#94a3b8',
    fontSize: 13
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#334155',
    borderRadius: 12
  },
  cancelText: {
    color: '#fff',
    fontWeight: '600'
  }
});
